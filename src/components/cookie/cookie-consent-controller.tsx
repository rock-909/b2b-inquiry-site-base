"use client";

import { useEffect, useState } from "react";
import { CookieBanner } from "@/components/cookie/cookie-banner";
import { EnterpriseAnalyticsIsland } from "@/components/monitoring/enterprise-analytics-island";
import {
  clearConsent,
  createAcceptAllConsent,
  createRejectAllConsent,
  loadConsent,
  saveConsent,
} from "@/lib/cookie-consent/storage";
import {
  CONSENT_CHANGE_EVENT,
  CONSENT_STORAGE_KEY,
  OPEN_CONSENT_EVENT,
  type CookieConsent,
} from "@/lib/cookie-consent/types";

export function CookieConsentController() {
  const [consent, setConsent] = useState<CookieConsent | null | undefined>(
    undefined,
  );

  useEffect(() => {
    const hydrateConsent = () => setConsent(loadConsent()?.consent ?? null);
    queueMicrotask(hydrateConsent);
    const reopen = () => {
      clearConsent();
      setConsent(null);
      window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
    };
    // 其他标签页改动或撤回选择时，本标签页重新读取，保证撤回立即生效
    const syncFromOtherTab = (event: StorageEvent) => {
      if (event.key === null || event.key === CONSENT_STORAGE_KEY) {
        hydrateConsent();
      }
    };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    window.addEventListener("storage", syncFromOtherTab);
    return () => {
      window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
      window.removeEventListener("storage", syncFromOtherTab);
    };
  }, []);

  if (consent === undefined) {
    return null;
  }

  const choose = (nextConsent: CookieConsent) => {
    saveConsent(nextConsent);
    setConsent(nextConsent);
    window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
  };

  return (
    <>
      {consent === null ? (
        <CookieBanner
          onAccept={() => choose(createAcceptAllConsent())}
          onReject={() => choose(createRejectAllConsent())}
          onSave={(choice) => choose({ necessary: true, ...choice })}
        />
      ) : null}
      <EnterpriseAnalyticsIsland
        analyticsAllowed={consent?.analytics === true}
        advertisingAllowed={consent?.advertising === true}
      />
    </>
  );
}
