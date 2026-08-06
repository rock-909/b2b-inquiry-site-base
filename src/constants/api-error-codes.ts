/**
 * API Error Codes
 *
 * Standardized error codes for all API responses.
 * These codes are stable identifiers for machine consumption.
 * Human-readable messages are handled by client-side i18n.
 *
 * Naming convention: CATEGORY_ACTION_DETAIL
 */

// ============================================
// Common Error Codes (used across multiple APIs)
// ============================================

export const API_ERROR_CODES = {
  // Rate limiting
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // Server errors
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",

  // Request validation
  INVALID_JSON_BODY: "INVALID_JSON_BODY",
  INVALID_REQUEST: "INVALID_REQUEST",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",

  // ============================================
  // Inquiry API
  // ============================================
  INQUIRY_VALIDATION_FAILED: "INQUIRY_VALIDATION_FAILED",
  INQUIRY_PROCESSING_ERROR: "INQUIRY_PROCESSING_ERROR",

  // ============================================
  // Turnstile Verification API
  // ============================================
  TURNSTILE_REQUIRED: "TURNSTILE_REQUIRED",
  TURNSTILE_REJECTED: "TURNSTILE_REJECTED",
  TURNSTILE_UNAVAILABLE: "TURNSTILE_UNAVAILABLE",

  // ============================================
  // Generic Error (fallback)
  // ============================================
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export type ApiErrorCode =
  (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
