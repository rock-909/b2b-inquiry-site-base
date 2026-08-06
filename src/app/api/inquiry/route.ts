/**
 * Shared public inquiry API route.
 * Contact, Request Quote, and validated catalog context all write through `/api/inquiry`.
 */

import "server-only";
import { NextRequest, type NextResponse } from "next/server";
import {
  createApiErrorResponse,
  createApiSuccessResponse,
} from "@/lib/api/api-response";
import { mapInquiryValidationDetails } from "@/lib/api/inquiry-validation-details";
import { createCorsRateLimitedRoute } from "@/lib/api/cors-rate-limited-route";
import { safeParseJson } from "@/lib/api/safe-parse-json";
import { isRuntimeProduction } from "@/lib/env";
import { type RateLimitContext } from "@/lib/api/with-rate-limit";
import { HTTP_BAD_REQUEST, HTTP_INTERNAL_ERROR } from "@/constants";
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
  PRODUCT_LEAD_TYPE,
  productLeadSchema,
  type ProductLeadInput,
} from "@/lib/lead-pipeline/lead-schema";
import { logger, sanitizeIP } from "@/lib/logger";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import {
  mapLeadTurnstileResultToResponse,
  verifyLeadTurnstile,
} from "@/lib/security/lead-turnstile";

interface ProductLeadValidationSuccess {
  success: true;
  data: ProductLeadInput;
}

interface ProductLeadValidationFailure {
  success: false;
  details: string[];
}

type ProductLeadValidationResult =
  ProductLeadValidationSuccess | ProductLeadValidationFailure;

function isInquiryHoneypotTriggered(data: Record<string, unknown>): boolean {
  const { website } = data;
  return typeof website === "string" && website.trim().length > 0;
}

async function validateProductInquiryTurnstile(
  token: unknown,
  clientIP: string,
): Promise<NextResponse | null> {
  const verificationResult = await verifyLeadTurnstile({
    token,
    clientIP,
  });

  const error = mapLeadTurnstileResultToResponse(verificationResult);
  return error ? createApiErrorResponse(error.errorCode, error.status) : null;
}

function validateLeadData(
  data: Record<string, unknown>,
): ProductLeadValidationResult {
  // 由 schema 决定哪些字段活下来，路由不再手写白名单：zod 的 object 默认剥离未知
  // 键，turnstileToken / website / phone 本来就进不去。这一段管的只是
  // 「路由 → processValidatedInquiry」这一跳，加字段时这里不用改。
  // 整条链路不止这一跳：浏览器发不发（createInquiryPayload）、邮件收不收
  // （createProductEmailData）、Airtable 收不收（createProductLeadRecord）
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
    type: PRODUCT_LEAD_TYPE,
  };
  const parsed = productLeadSchema.safeParse(schemaInput);

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

function createProductInquirySuccessResponse(
  result: LeadResult,
  clientIP: string,
  startTime: number,
) {
  if (!isRuntimeProduction()) {
    logger.info("Product inquiry submitted successfully", {
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

function createProductInquiryFailureResponse(
  result: LeadResult,
  clientIP: string,
  startTime: number,
) {
  logger.warn("Product inquiry submission failed", {
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
  const referenceId = generateLeadReferenceId(PRODUCT_LEAD_TYPE);

  logger.warn("Inquiry honeypot triggered", {
    referenceId,
    ip: sanitizeIP(clientIP),
    processingTime: Date.now() - startTime,
  });

  return createApiSuccessResponse({ referenceId });
}

/**
 * POST /api/inquiry
 * Handle product inquiry form submission
 */
async function handleInquiryPost(
  request: NextRequest,
  { clientIP }: RateLimitContext,
) {
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

    const turnstileError = await validateProductInquiryTurnstile(
      data.turnstileToken,
      clientIP,
    );
    if (turnstileError) return turnstileError;

    const result = await processValidatedInquiry(leadValidation.data);

    if (result.success) {
      return createProductInquirySuccessResponse(result, clientIP, startTime);
    }

    return createProductInquiryFailureResponse(result, clientIP, startTime);
  } catch (error) {
    logger.error("Product inquiry submission failed unexpectedly", {
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

export const { POST, OPTIONS } = createCorsRateLimitedRoute(
  "inquiry",
  handleInquiryPost,
);
