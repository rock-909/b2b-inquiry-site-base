import {
  API_ERROR_CODES,
  type ApiErrorCode,
} from "@/constants/api-error-codes";
import { type ApiErrorResponse } from "@/lib/api/api-response";
import { readLeadReferenceId } from "@/lib/forms/lead-response";

export type InquiryErrorKind = "field" | "security" | "server";

export interface InquirySubmitState {
  readonly status: "idle" | "submitting" | "success" | "error";
  readonly referenceId?: string;
  readonly errorKind?: InquiryErrorKind;
  readonly fieldDetails?: readonly string[];
}

const SECURITY_ERROR_CODES = new Set<ApiErrorCode>([
  API_ERROR_CODES.TURNSTILE_REQUIRED,
  API_ERROR_CODES.TURNSTILE_REJECTED,
  API_ERROR_CODES.TURNSTILE_UNAVAILABLE,
]);

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
    return {
      status: "error",
      errorKind: "field",
      ...(payload.details ? { fieldDetails: payload.details } : {}),
    };
  }

  if (SECURITY_ERROR_CODES.has(payload.errorCode)) {
    return { status: "error", errorKind: "security" };
  }

  return { status: "error", errorKind: "server" };
}
