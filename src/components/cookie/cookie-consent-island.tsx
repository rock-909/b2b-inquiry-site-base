"use client";

import { useEffect, useState } from "react";
import { CookieBanner } from "@/components/cookie/cookie-banner";
import { EnterpriseAnalyticsIsland } from "@/components/monitoring/enterprise-analytics-island";
import {
  createAcceptAllConsent,
  createRejectAllConsent,
  loadConsent,
  saveConsent,
} from "@/lib/cookie-consent/storage";
import type { CookieConsent } from "@/lib/cookie-consent/types";
import { getPublicRuntimeEnvString } from "@/lib/public-runtime-env";

export function CookieConsentIsland() {
  const analyticsConfigured = Boolean(
    getPublicRuntimeEnvString("NEXT_PUBLIC_GA_MEASUREMENT_ID"),
  );
  const [consent, setConsent] = useState<CookieConsent | null | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!analyticsConfigured) return undefined;

    const hydrateConsent = () => setConsent(loadConsent()?.consent ?? null);
    queueMicrotask(hydrateConsent);
    return () => undefined;
  }, [analyticsConfigured]);

  if (!analyticsConfigured || consent === undefined) {
    return null;
  }

  const choose = (nextConsent: CookieConsent) => {
    saveConsent(nextConsent);
    setConsent(nextConsent);
  };

  return (
    <>
      {consent === null ? (
        <CookieBanner
          onAccept={() => choose(createAcceptAllConsent())}
          onReject={() => choose(createRejectAllConsent())}
        />
      ) : null}
      <EnterpriseAnalyticsIsland
        analyticsAllowed={consent?.analytics === true}
      />
    </>
  );
}
