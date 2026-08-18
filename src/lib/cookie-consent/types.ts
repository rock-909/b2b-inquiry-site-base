/**
 * Cookie Consent Type Definitions
 *
 * Type-safe definitions for cookie consent management,
 * supporting GDPR/CCPA compliance requirements.
 */

/** User consent state for each category */
export interface CookieConsent {
  /** Essential cookies (Turnstile, locale, theme) - always true */
  necessary: true;
  /** Analytics cookies such as GA4, if configured */
  analytics: boolean;
}

/** Persisted consent data structure */
export interface StoredConsent {
  consent: CookieConsent;
  /** ISO 8601 timestamp of last consent update */
  updatedAt: string;
  /** Consent schema version for future migrations */
  version: number;
}

/** Default consent (before user action) - conservative defaults */
export const DEFAULT_CONSENT: CookieConsent = {
  necessary: true,
  analytics: false,
} as const;

/** Current storage schema version */
export const CONSENT_VERSION = 2;

/** localStorage key for consent data */
export const CONSENT_STORAGE_KEY = "cookie-consent";
