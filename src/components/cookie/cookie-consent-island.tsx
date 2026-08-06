"use client";

import { lazy, Suspense } from "react";
import { CookieConsentProvider } from "@/lib/cookie-consent";
import { isPublicRuntimeProduction } from "@/lib/public-runtime-env";
import { LazyCookieBanner } from "@/components/cookie/lazy-cookie-banner";
import { LazyIslandErrorBoundary } from "@/components/ui/lazy-island-error-boundary";

const EnterpriseAnalyticsIsland = lazy(() =>
  import("@/components/monitoring/enterprise-analytics-island").then((mod) => ({
    default: mod.EnterpriseAnalyticsIsland,
  })),
);

/**
 * Cookie Consent Island
 *
 * Wraps only the components that consume CookieConsentContext, avoiding
 * unnecessary context propagation through the entire tree.
 *
 * Consumers:
 * - LazyCookieBanner: displays consent UI
 * - EnterpriseAnalyticsIsland: conditionally loads analytics based on consent
 */
export function CookieConsentIsland() {
  const isProd = isPublicRuntimeProduction();

  return (
    <CookieConsentProvider>
      <Suspense fallback={null}>
        <LazyCookieBanner />
      </Suspense>
      {isProd ? (
        <LazyIslandErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <EnterpriseAnalyticsIsland />
          </Suspense>
        </LazyIslandErrorBoundary>
      ) : null}
    </CookieConsentProvider>
  );
}
