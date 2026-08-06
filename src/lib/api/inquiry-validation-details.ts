import { type ZodIssue } from "zod";
import {
  mapZodIssuesToValidationDetails,
  type ValidationFieldErrorKeys,
} from "@/lib/api/validation-error-details";

/**
 * Inquiry field → inquiry.form error namespace prefixes.
 */
export const PRODUCT_INQUIRY_FIELD_ERROR_KEYS = {
  fullName: "errors.fullName",
  email: "errors.email",
  message: "errors.message",
} as const satisfies ValidationFieldErrorKeys;

/**
 * Detail leaves with matching inquiry.form copy for visible field errors.
 */
export const PRODUCT_INQUIRY_RENDERABLE_DETAIL_KEYS = [
  "errors.fullName.required",
  "errors.fullName.invalid",
  "errors.fullName.tooLong",
  "errors.email.required",
  "errors.email.invalid",
  "errors.email.tooLong",
  "errors.message.invalid",
  "errors.message.tooLong",
] as const;

/**
 * Detail leaves the inquiry mapper can emit for productLeadSchema.
 * Usage gate binds renderable keys — keep it aligned with behavior tests.
 */
export const PRODUCT_INQUIRY_VALIDATION_DETAIL_KEYS = [
  "errors.generic",
  ...PRODUCT_INQUIRY_RENDERABLE_DETAIL_KEYS,
] as const;

export function mapInquiryValidationDetails(
  issues: readonly ZodIssue[],
  source: Record<string, unknown> = {},
): string[] {
  return mapZodIssuesToValidationDetails(
    issues,
    PRODUCT_INQUIRY_FIELD_ERROR_KEYS,
    source,
  );
}
