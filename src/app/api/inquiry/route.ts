/**
 * Shared public inquiry API route.
 * The site's single inquiry form writes through `/api/inquiry`.
 */

import "server-only";

import { NextRequest, type NextResponse } from "next/server";
import {
  createApiErrorResponse,
  createApiSuccessResponse,
} from "@/lib/api/api-response";
import { isSameOrigin } from "@/lib/security/origin-policy";
import { mapInquiryValidationDetails } from "@/lib/api/inquiry-validation-details";
import { safeParseJson } from "@/lib/api/safe-parse-json";
import { isRuntimeProduction } from "@/lib/env";
import {
  HTTP_BAD_REQUEST,
  HTTP_FORBIDDEN,
  HTTP_INTERNAL_ERROR,
  HTTP_SERVICE_UNAVAILABLE,
  HTTP_TOO_MANY_REQUESTS,
  HTTP_UNSUPPORTED_MEDIA_TYPE,
} from "@/constants";
import {
  processValidatedInquiry,
  type LeadResult,
} from "@/lib/lead-pipeline/process-lead";
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
import { verifyLeadTurnstile } from "@/lib/security/lead-turnstile";
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

  switch (verificationResult.status) {
    case "verified":
      return null;
    case "missing":
      return createApiErrorResponse(
        API_ERROR_CODES.TURNSTILE_REQUIRED,
        HTTP_BAD_REQUEST,
      );
    case "service-unavailable":
      return createApiErrorResponse(
        API_ERROR_CODES.TURNSTILE_UNAVAILABLE,
        HTTP_SERVICE_UNAVAILABLE,
      );
    case "failed":
      return createApiErrorResponse(
        API_ERROR_CODES.TURNSTILE_REJECTED,
        HTTP_BAD_REQUEST,
      );
    default: {
      const exhaustiveStatus: never = verificationResult;
      return exhaustiveStatus;
    }
  }
}

function validateLeadData(
  data: Record<string, unknown>,
): InquiryLeadValidationResult {
  // 由 schema 决定哪些字段活下来，路由不再手写白名单：zod 的 object 默认剥离未知
  // 键，turnstileToken / website / phone 本来就进不去。这一段管的只是
  // 「路由 → processValidatedInquiry」这一跳，加字段时这里不用改。
  // 新增买家字段仍需核对浏览器 payload 与输出适配器：统一输入类型不代表
  // 邮件模板和 Airtable 列映射会自动展示新字段，分别见 runtime-email-content.ts
  // 和 airtable/service-internal/lead-records.ts。
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
  result: Extract<LeadResult, { success: true }>,
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

  return createApiSuccessResponse({ referenceId: result.referenceId });
}

function createInquiryFailureResponse(
  result: Extract<LeadResult, { success: false }>,
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
  const referenceId = generateLeadReferenceId();

  logger.warn("Inquiry honeypot triggered", {
    referenceId,
    ip: sanitizeIP(clientIP),
    processingTime: Date.now() - startTime,
  });

  return createApiSuccessResponse({ referenceId });
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

    return result.success
      ? createInquirySuccessResponse(result, clientIP, startTime)
      : createInquiryFailureResponse(result, clientIP, startTime);
  } catch (error) {
    logger.error("Inquiry submission failed unexpectedly", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      ip: sanitizeIP(clientIP),
      processingTime: Date.now() - startTime,
    });

    return createApiErrorResponse(
      API_ERROR_CODES.INQUIRY_PROCESSING_ERROR,
      HTTP_INTERNAL_ERROR,
    );
  }
}

/**
 * S-F01 请求闸门：在触碰限流存储之前丢弃不可能来自本站前端的请求。
 *
 * 跨站表单（text/plain）和跨站 Origin 的 POST 不可能是合法买家流量，
 * 却会消耗真实 IP 的限流配额把正常买家挤出窗口——所以这两类检查必须
 * 排在 checkInquiryRateLimit 之前。没有 Origin 的请求放行：CSRF 需要
 * 浏览器才成立，curl/监控类客户端不带 Origin 属于正常形态。
 */
function rejectPlausiblyIllegitimateRequest(
  request: NextRequest,
  clientIP: string,
): NextResponse | null {
  // 取分号前的媒体类型做精确比较：startsWith 会放过 application/jsonx
  // 这类前缀混淆头（R1 验收阻塞项）；charset 参数照常放行。
  const mediaType = (request.headers.get("content-type") ?? "")
    .split(";")[0]!
    .trim()
    .toLowerCase();

  if (mediaType !== "application/json") {
    return createApiErrorResponse(
      API_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
      HTTP_UNSUPPORTED_MEDIA_TYPE,
    );
  }

  const origin = request.headers.get("origin");

  if (!isSameOrigin(origin, request.url)) {
    logger.warn("Inquiry request rejected by origin gate", {
      ip: sanitizeIP(clientIP),
    });
    return createApiErrorResponse(
      API_ERROR_CODES.INVALID_REQUEST,
      HTTP_FORBIDDEN,
    );
  }

  return null;
}

/**
 * 限流存储或私钥不可用时放行询盘（业主决定）：Turnstile 仍是反滥用闸门，
 * 而拒绝会连同仍能正常交付的真实买家一起挡掉。只有真实超限才返回 429。
 * 缺配置由部署前的 production-config 检查拦截，运行时只记日志、不挡买家。
 */
async function rejectIfRateLimited(
  clientIP: string,
): Promise<NextResponse | null> {
  let rateLimitKey: string;
  let result: Awaited<ReturnType<typeof checkInquiryRateLimit>>;

  try {
    rateLimitKey = await getIPKey(clientIP);
    result = await checkInquiryRateLimit(rateLimitKey);
  } catch (error) {
    logger.error("Rate limit unavailable; allowing inquiry to proceed", {
      reason: "key_failure",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }

  if (result.allowed) return null;

  if (result.deniedReason === "storage_failure") {
    logger.warn("Rate limit unavailable; allowing inquiry to proceed", {
      reason: "storage_failure",
    });
    return null;
  }

  logger.warn("Rate limit exceeded", {
    keyPrefix: rateLimitKey.slice(0, 8),
    retryAfter: result.retryAfter,
  });

  const response = createApiErrorResponse(
    API_ERROR_CODES.RATE_LIMIT_EXCEEDED,
    HTTP_TOO_MANY_REQUESTS,
  );

  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(result.resetTime));
  if (result.retryAfter !== null) {
    response.headers.set("Retry-After", String(result.retryAfter));
  }
  return response;
}

export async function POST(request: NextRequest) {
  // 每个请求只解析一次客户端 IP，准入闸门、限流 key 与后续日志共用同一个值。
  const clientIP = getClientIP(request);
  const gateRejection = rejectPlausiblyIllegitimateRequest(request, clientIP);

  if (gateRejection) return gateRejection;

  const rateLimitRejection = await rejectIfRateLimited(clientIP);

  if (rateLimitRejection) return rateLimitRejection;

  return handleInquiryPost(request, clientIP);
}
