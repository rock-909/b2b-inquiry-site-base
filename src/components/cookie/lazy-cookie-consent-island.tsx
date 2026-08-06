"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { requestIdleCallback } from "@/lib/idle-callback";
import { IDLE_CALLBACK_TIMEOUT_LONG } from "@/constants/time";

const CookieConsentIsland = lazy(() =>
  import("@/components/cookie/cookie-consent-island").then((mod) => ({
    default: mod.CookieConsentIsland,
  })),
);

/**
 * Lazy Cookie Consent Island
 *
 * Defers CookieConsentProvider initialization until after the main thread is idle,
 * reducing Total Blocking Time (TBT) during initial page load.
 *
 * The cookie consent banner is non-critical for initial render,
 * so deferring it improves Core Web Vitals without impacting UX.
 */
export function LazyCookieConsentIsland() {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (shouldRender) return undefined;

    return requestIdleCallback(() => setShouldRender(true), {
      fallbackDelay: IDLE_CALLBACK_TIMEOUT_LONG,
      timeout: IDLE_CALLBACK_TIMEOUT_LONG,
    });
  }, [shouldRender]);

  if (!shouldRender) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <CookieConsentIsland />
    </Suspense>
  );
}
