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

export function CookieConsentController() {
  const [consent, setConsent] = useState<CookieConsent | null | undefined>(
    undefined,
  );

  useEffect(() => {
    const hydrateConsent = () => setConsent(loadConsent()?.consent ?? null);
    queueMicrotask(hydrateConsent);
    return () => undefined;
  }, []);

  if (consent === undefined) {
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
