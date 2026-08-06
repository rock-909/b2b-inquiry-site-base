/**
 * Cookie Consent Module
 *
 * Re-exports all cookie consent utilities for convenient imports.
 */

export {
  CookieConsentProvider,
  useCookieConsent,
  useCookieConsentOptional,
} from "@/lib/cookie-consent/context";

export {
  type CookieCategory,
  type CookieConsent,
  type CookieConsentActions,
  type CookieConsentContextValue,
  type CookieConsentState,
  type StoredConsent,
} from "@/lib/cookie-consent/types";
