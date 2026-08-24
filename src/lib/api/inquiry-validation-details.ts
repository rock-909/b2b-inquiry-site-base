import { type ZodIssue } from "zod";
import {
  type InquiryErrorField,
  INQUIRY_FIELD_ERROR_DETAILS,
  INQUIRY_FIELD_ERROR_KEYS as PROTOCOL_FIELD_ERROR_KEYS,
} from "@/constants/inquiry-field-error-protocol";
import {
  mapZodIssuesToValidationDetails,
  type ValidationFieldErrorKeys,
} from "@/lib/api/validation-error-details";

/**
 * Inquiry field → inquiry.form error namespace prefixes.
 * 从 client-safe 协议模块派生，新增 detail 只改协议常量，不改这里。
 */
export const INQUIRY_FIELD_ERROR_KEYS =
  PROTOCOL_FIELD_ERROR_KEYS satisfies ValidationFieldErrorKeys &
    Record<InquiryErrorField, string>;

/**
 * Detail leaves with matching inquiry.form copy for visible field errors.
 */
export const INQUIRY_RENDERABLE_DETAIL_KEYS = INQUIRY_FIELD_ERROR_DETAILS;

/**
 * Detail leaves the inquiry mapper can emit for inquiryLeadSchema.
 * Usage gate binds renderable keys — keep it aligned with behavior tests.
 */
export const INQUIRY_VALIDATION_DETAIL_KEYS = [
  "errors.generic",
  ...INQUIRY_RENDERABLE_DETAIL_KEYS,
] as const;

export function mapInquiryValidationDetails(
  issues: readonly ZodIssue[],
  source: Record<string, unknown> = {},
): string[] {
  return mapZodIssuesToValidationDetails(
    issues,
    INQUIRY_FIELD_ERROR_KEYS,
    source,
  );
}
