import type { CookieConsentContextValue } from "@/lib/cookie-consent/types";

export function resolveAnalyticsAllowed(
  consent: Pick<CookieConsentContextValue, "ready" | "consent"> | null,
): boolean {
  if (!consent) return false;
  if (!consent.ready) return false;
  return consent.consent.analytics;
}
