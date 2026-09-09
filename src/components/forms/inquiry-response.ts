import {
  API_ERROR_CODES,
  type ApiErrorCode,
} from "@/constants/api-error-codes";
import { type ApiErrorResponse } from "@/lib/api/api-response";
import { readLeadReferenceId } from "@/lib/forms/lead-response";

export type InquiryErrorKind = "field" | "security" | "rateLimit" | "server";

export interface InquirySubmitState {
  readonly status: "idle" | "submitting" | "success" | "error";
  readonly referenceId?: string;
  readonly errorKind?: InquiryErrorKind;
  readonly fieldDetails?: readonly string[];
  /** 仅 rateLimit 错误携带；已经过合法性校验与上限约束。 */
  readonly retryAfterSeconds?: number;
}

const SECURITY_ERROR_CODES = new Set<ApiErrorCode>([
  API_ERROR_CODES.TURNSTILE_REQUIRED,
  API_ERROR_CODES.TURNSTILE_REJECTED,
  API_ERROR_CODES.TURNSTILE_UNAVAILABLE,
]);

const DEFAULT_RETRY_AFTER_SECONDS = 60;
const MAX_RETRY_AFTER_SECONDS = 120;

/**
 * 只认十进制整数的 delta-seconds。当前 API 恒发数字 header，不实现 HTTP-date
 * 解析；异常大值不 clamp 而是回退默认值——不让恶意或异常 header 决定新的
 * 业务等待时长。
 */
function readRetryAfterSeconds(response: Response): number {
  const raw = response.headers.get("Retry-After")?.trim() ?? "";

  if (!/^\d+$/u.test(raw)) {
    return DEFAULT_RETRY_AFTER_SECONDS;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isSafeInteger(parsed) || parsed > MAX_RETRY_AFTER_SECONDS) {
    return DEFAULT_RETRY_AFTER_SECONDS;
  }

  return parsed;
}

function isApiErrorPayload(payload: unknown): payload is ApiErrorResponse {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "success" in payload &&
    payload.success === false &&
    typeof (payload as ApiErrorResponse).errorCode === "string"
  );
}

export async function decodeInquirySubmitState(
  response: Response,
): Promise<InquirySubmitState> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return { status: "error", errorKind: "server" };
  }

  const referenceId = readLeadReferenceId(response.ok, payload);
  if (referenceId !== null) {
    return { status: "success", referenceId };
  }

  if (!isApiErrorPayload(payload)) {
    return { status: "error", errorKind: "server" };
  }

  if (payload.errorCode === API_ERROR_CODES.INQUIRY_VALIDATION_FAILED) {
    if (
      payload.details !== undefined &&
      (!Array.isArray(payload.details) ||
        !payload.details.every((detail) => typeof detail === "string"))
    ) {
      return { status: "error", errorKind: "server" };
    }
    return {
      status: "error",
      errorKind: "field",
      ...(payload.details ? { fieldDetails: payload.details } : {}),
    };
  }

  if (payload.errorCode === API_ERROR_CODES.RATE_LIMIT_EXCEEDED) {
    return {
      status: "error",
      errorKind: "rateLimit",
      retryAfterSeconds: readRetryAfterSeconds(response),
    };
  }

  if (SECURITY_ERROR_CODES.has(payload.errorCode)) {
    return { status: "error", errorKind: "security" };
  }

  return { status: "error", errorKind: "server" };
}
