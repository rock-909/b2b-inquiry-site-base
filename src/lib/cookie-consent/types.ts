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

/** <html> 上的 data-consent-pending：预绘制脚本没找到有效的存储记录时设置，同意卡片据此从首帧显示 */
export const CONSENT_PENDING_DATASET_KEY = "consentPending";

/** 页脚“Cookie 设置”按钮发出此事件，让同意横幅重新出现 */
export const OPEN_CONSENT_EVENT = "cookie-consent:open";
