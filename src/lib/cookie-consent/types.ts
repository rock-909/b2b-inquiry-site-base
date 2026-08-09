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
  /** Marketing cookies (future ads and campaign attribution) */
  marketing: boolean;
}

/** Persisted consent data structure */
export interface StoredConsent {
  consent: CookieConsent;
  /** ISO 8601 timestamp of last consent update */
  updatedAt: string;
  /** Consent schema version for future migrations */
  version: number;
}

/** Context state for cookie consent */
export interface CookieConsentState {
  /** Current consent preferences */
  consent: CookieConsent;
  /** Whether consent has been explicitly set by user */
  hasConsented: boolean;
  /** Whether the context is ready (hydrated from storage) */
  ready: boolean;
}

/** Actions available in cookie consent context */
export interface CookieConsentActions {
  /** Accept all cookie categories */
  acceptAll: () => void;
  /** Reject all optional cookies (keep necessary) */
  rejectAll: () => void;
  /** Save custom consent preferences */
  savePreferences: (
    preferences: Partial<Omit<CookieConsent, "necessary">>,
  ) => void;
}

/** Combined context value */
export type CookieConsentContextValue = CookieConsentState &
  CookieConsentActions;

/** Default consent (before user action) - conservative defaults */
export const DEFAULT_CONSENT: CookieConsent = {
  necessary: true,
  analytics: false,
  marketing: false,
} as const;

/** Current storage schema version */
export const CONSENT_VERSION = 1;

/** localStorage key for consent data */
export const CONSENT_STORAGE_KEY = "cookie-consent";
