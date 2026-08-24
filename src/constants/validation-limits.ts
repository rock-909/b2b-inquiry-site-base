/**
 * Validation Limits and Constraints
 *
 * Centralized constants for input validation, character limits,
 * and size constraints throughout the application.
 *
 * Naming convention: MAX_[DOMAIN]_[DESCRIPTION] or MIN_[DOMAIN]_[DESCRIPTION]
 */

// ============================================================================
// Lead Pipeline Limits (shared inquiry forms)
// ============================================================================

/**
 * Max email length (RFC 5321 / 5322 practical limit).
 * Commonly validated as 254 characters.
 */
export const MAX_LEAD_EMAIL_LENGTH = 254 as const;

/** Max full name length for lead forms. */
export const MAX_LEAD_NAME_LENGTH = 100 as const;

/** Max buyer interest length for canonical inquiry leads. */

/** Max optional buyer message length for canonical inquiry leads. */
export const MAX_LEAD_MESSAGE_LENGTH = 2000 as const;

/** Max length for estimator `?config=` URL prefill on the inquiry form. */
