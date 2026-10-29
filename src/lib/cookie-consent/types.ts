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
  /** Advertising cookies such as Google Ads, if configured */
  advertising: boolean;
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
  advertising: false,
} as const;

/** Current storage schema version */
export const CONSENT_VERSION = 3;

/** localStorage key for consent data */
export const CONSENT_STORAGE_KEY = "cookie-consent";

/** 页脚“Cookie 设置”按钮发出此事件，让同意横幅重新出现 */
export const OPEN_CONSENT_EVENT = "cookie-consent:open";

/** 同一标签页里保存或撤回选择后发出，语言建议条据此决定是否出现 */
export const CONSENT_CHANGE_EVENT = "cookie-consent:change";
