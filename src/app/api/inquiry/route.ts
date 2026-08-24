/**
 * Shared public inquiry API route.
 * The site's single inquiry form writes through `/api/inquiry`.
 */

import "server-only";

import { recordInquiryIncident } from "@/lib/observability/inquiry-failure-latch";
import { scheduleObservabilityWrite } from "@/lib/observability/schedule-observability-write";
import { NextRequest, type NextResponse } from "next/server";
import {
  createApiErrorResponse,
  createApiSuccessResponse,
} from "@/lib/api/api-response";
import {
  applyCorsHeaders,
  createCorsPreflightResponse,
} from "@/lib/api/cors-utils";
import { mapInquiryValidationDetails } from "@/lib/api/inquiry-validation-details";
import { safeParseJson } from "@/lib/api/safe-parse-json";
import { isRuntimeProduction } from "@/lib/env";
import {
  HTTP_BAD_REQUEST,
  HTTP_INTERNAL_ERROR,
  HTTP_SERVICE_UNAVAILABLE,
  HTTP_TOO_MANY_REQUESTS,
} from "@/constants";
import {
  processValidatedInquiry,
  type LeadResult,
} from "@/lib/lead-pipeline/process-lead";
import { getSuccessfulLeadReferenceId } from "@/lib/lead-pipeline/success-reference";
import { generateLeadReferenceId } from "@/lib/lead-pipeline/utils";
import {
  ATTRIBUTION_FIELD_NAMES,
  pickAttributionFields,
} from "@/lib/marketing/attribution-fields";
import {
  INQUIRY_LEAD_TYPE,
  inquiryLeadSchema,
  type InquiryLeadInput,
} from "@/lib/lead-pipeline/lead-schema";
import { logger, sanitizeIP } from "@/lib/logger";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { getClientIP } from "@/lib/security/client-ip";
import { checkInquiryRateLimit } from "@/lib/security/distributed-rate-limit";
import {
  mapLeadTurnstileResultToResponse,
  verifyLeadTurnstile,
} from "@/lib/security/lead-turnstile";
import { getIPKey } from "@/lib/security/rate-limit-key-strategies";

interface InquiryLeadValidationSuccess {
  success: true;
  data: InquiryLeadInput;
}

interface InquiryLeadValidationFailure {
  success: false;
  details: string[];
}

type InquiryLeadValidationResult =
  InquiryLeadValidationSuccess | InquiryLeadValidationFailure;

function isInquiryHoneypotTriggered(data: Record<string, unknown>): boolean {
  const { website } = data;
  return typeof website === "string" && website.trim().length > 0;
}

async function validateInquiryTurnstile(
  token: unknown,
  clientIP: string,
): Promise<NextResponse | null> {
  const verificationResult = await verifyLeadTurnstile({
    token,
    clientIP,
  });

  // Cloudflare 侧不可达/5xx/超时属于基础设施事故，不是买家的失败：
  // 记入事故闩锁让外部监控发现；正常拒绝（token 无效）不触发。
  if (verificationResult.status === "service-unavailable") {
    await recordInquiryIncident("turnstile_unavailable");
  }

  const error = mapLeadTurnstileResultToResponse(verificationResult);
  return error ? createApiErrorResponse(error.errorCode, error.status) : null;
}

function validateLeadData(
  data: Record<string, unknown>,
): InquiryLeadValidationResult {
  // 由 schema 决定哪些字段活下来，路由不再手写白名单：zod 的 object 默认剥离未知
  // 键，turnstileToken / website / phone 本来就进不去。这一段管的只是
  // 「路由 → processValidatedInquiry」这一跳，加字段时这里不用改。
  // 整条链路不止这一跳：浏览器发不发（createInquiryPayload）、邮件收不收
  // （createInquiryEmailData）、Airtable 收不收（createInquiryLeadRecord）
  // 各有各的字段清单，加买家字段时那三处仍要一起看。
  // 归因字段必须先整组剔除、再放清洗结果：pickAttributionFields 碰到非字符串值是
  // 「整个键不写入」而不是写 undefined，直接展开的话原始脏值会活下来，买家会因为
  // 一个营销参数格式不对被整单拒绝。
  // type 放最后：服务端写死，客户端伪造不了。
  const rest = { ...data };
  for (const fieldName of ATTRIBUTION_FIELD_NAMES) {
    delete rest[fieldName];
  }

  const schemaInput = {
    ...rest,
    ...pickAttributionFields(data),
    type: INQUIRY_LEAD_TYPE,
  };
  const parsed = inquiryLeadSchema.safeParse(schemaInput);

  if (parsed.success) {
    return {
      success: true,
      data: parsed.data,
    };
  }

  return {
    success: false,
    details: mapInquiryValidationDetails(parsed.error.issues, schemaInput),
  };
}

function createInquirySuccessResponse(
  result: LeadResult,
  clientIP: string,
  startTime: number,
) {
  if (!isRuntimeProduction()) {
    logger.info("Inquiry submitted successfully", {
      referenceId: result.referenceId,
      ip: sanitizeIP(clientIP),
      processingTime: Date.now() - startTime,
      emailSent: result.emailSent,
      recordCreated: result.recordCreated,
    });
  }

  return createApiSuccessResponse({
    referenceId: getSuccessfulLeadReferenceId(
      result,
      "referenceId missing on successful lead result",
    ),
  });
}

function createInquiryFailureResponse(
  result: LeadResult,
  clientIP: string,
  startTime: number,
) {
  logger.warn("Inquiry submission failed", {
    error: result.error,
    ip: sanitizeIP(clientIP),
    processingTime: Date.now() - startTime,
    referenceId: result.referenceId,
  });

  return createApiErrorResponse(
    API_ERROR_CODES.INQUIRY_PROCESSING_ERROR,
    HTTP_INTERNAL_ERROR,
  );
}

function createInquiryHoneypotSuccessResponse(
  clientIP: string,
  startTime: number,
) {
  const referenceId = generateLeadReferenceId(INQUIRY_LEAD_TYPE);

  logger.warn("Inquiry honeypot triggered", {
    referenceId,
    ip: sanitizeIP(clientIP),
    processingTime: Date.now() - startTime,
  });

  return createApiSuccessResponse({ referenceId });
}

type DeliveryOutcome = {
  success: boolean;
  emailSent: boolean;
  recordCreated: boolean;
};

/**
 * 交付结果的告警分级：部分失败也要让业主知道哪条通道在漏；全部失败是最严重档。
 */
function incidentKindForDelivery(
  outcome: DeliveryOutcome,
):
  | "delivery_failed"
  | "email_delivery_failed"
  | "airtable_delivery_failed"
  | null {
  // 注意：任一通道成功时 process-lead 就返回 success=true，所以分级只能看
  // 真实通道结果——success 提前返回会漏掉全部单通道告警（首轮验收阻塞点）。
  if (!outcome.emailSent && !outcome.recordCreated) return "delivery_failed";
  if (!outcome.emailSent) return "email_delivery_failed";
  if (!outcome.recordCreated) return "airtable_delivery_failed";
  return null;
}

/**
 * 交付结果收尾：先按分级写事故闩锁（部分失败/全部失败），再返回对应响应。
 */
function finalizeInquiryOutcome(
  result: Awaited<ReturnType<typeof processValidatedInquiry>>,
  clientIP: string,
  startTime: number,
): NextResponse {
  const incidentKind = incidentKindForDelivery(result);

  if (incidentKind) {
    scheduleObservabilityWrite(
      recordInquiryIncident(incidentKind, result.referenceId),
    );
  }

  return result.success
    ? createInquirySuccessResponse(result, clientIP, startTime)
    : createInquiryFailureResponse(result, clientIP, startTime);
}

/**
 * POST /api/inquiry
 * Handle inquiry form submission.
 */
async function handleInquiryPost(request: NextRequest, clientIP: string) {
  const parsedBody = await safeParseJson<{
    turnstileToken?: string;
    website?: string;
    [key: string]: unknown;
  }>(request, { route: "/api/inquiry" });

  if (!parsedBody.ok) {
    return createApiErrorResponse(parsedBody.errorCode, parsedBody.statusCode);
  }

  const startTime = Date.now();

  try {
    const data = parsedBody.data ?? {};

    if (isInquiryHoneypotTriggered(data)) {
      return createInquiryHoneypotSuccessResponse(clientIP, startTime);
    }

    const leadValidation = validateLeadData(data);
    if (!leadValidation.success) {
      return createApiErrorResponse(
        API_ERROR_CODES.INQUIRY_VALIDATION_FAILED,
        HTTP_BAD_REQUEST,
        { details: leadValidation.details },
      );
    }

    const turnstileError = await validateInquiryTurnstile(
      data.turnstileToken,
      clientIP,
    );
    if (turnstileError) return turnstileError;

    const result = await processValidatedInquiry(leadValidation.data);

    return finalizeInquiryOutcome(result, clientIP, startTime);
  } catch (error) {
    logger.error("Inquiry submission failed unexpectedly", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      ip: sanitizeIP(clientIP),
      processingTime: Date.now() - startTime,
    });

    await recordInquiryIncident("unexpected_inquiry_error");

    return createApiErrorResponse(
      API_ERROR_CODES.INQUIRY_PROCESSING_ERROR,
      HTTP_INTERNAL_ERROR,
    );
  }
}

async function handleRateLimitedInquiryPost(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);
    const rateLimitKey = await getIPKey(request);
    const result = await checkInquiryRateLimit(rateLimitKey);

    if (result.allowed) {
      return handleInquiryPost(request, clientIP);
    }

    logger.warn("Rate limit exceeded", {
      keyPrefix: rateLimitKey.slice(0, 8),
      retryAfter: result.retryAfter,
      deniedReason: result.deniedReason,
    });

    const response = createApiErrorResponse(
      result.deniedReason === "storage_failure"
        ? API_ERROR_CODES.SERVICE_UNAVAILABLE
        : API_ERROR_CODES.RATE_LIMIT_EXCEEDED,
      result.deniedReason === "storage_failure"
        ? HTTP_SERVICE_UNAVAILABLE
        : HTTP_TOO_MANY_REQUESTS,
    );

    // 存储故障是 fail-closed：所有询盘都会被 503 拦住，属于基础设施事故。
    if (result.deniedReason === "storage_failure") {
      scheduleObservabilityWrite(
        recordInquiryIncident("rate_limit_store_unavailable"),
      );
    }

    response.headers.set("X-RateLimit-Remaining", String(result.remaining));
    response.headers.set("X-RateLimit-Reset", String(result.resetTime));
    if (result.retryAfter !== null) {
      response.headers.set("Retry-After", String(result.retryAfter));
    }
    return response;
  } catch (error) {
    logger.error("Unexpected rate limit infrastructure failure", { error });
    scheduleObservabilityWrite(
      recordInquiryIncident("rate_limit_store_unavailable"),
    );
    return createApiErrorResponse(
      API_ERROR_CODES.SERVICE_UNAVAILABLE,
      HTTP_SERVICE_UNAVAILABLE,
    );
  }
}

export async function POST(request: NextRequest) {
  return applyCorsHeaders({
    request,
    response: await handleRateLimitedInquiryPost(request),
  });
}

export function OPTIONS(request: NextRequest) {
  return createCorsPreflightResponse(request);
}
