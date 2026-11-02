"use client";

import { useEffect, useLayoutEffect, useState } from "react";
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
  CONSENT_PENDING_DATASET_KEY,
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

  // 预绘制脚本只看有没有存储记录就先显示了卡片；读完存储后由这里决定，同一帧内交还。
  useLayoutEffect(() => {
    if (consent !== undefined) {
      delete document.documentElement.dataset[CONSENT_PENDING_DATASET_KEY];
    }
  }, [consent]);

  const choose = (nextConsent: CookieConsent) => {
    saveConsent(nextConsent);
    setConsent(nextConsent);
  };

  // 卡片随服务端 HTML 输出，先隐藏；还没读存储时只有预绘制脚本能让它显示。
  return (
    <>
      {consent === undefined || consent === null ? (
        <CookieBanner
          hidden={consent === undefined}
          onAccept={() => choose(createAcceptAllConsent())}
          onReject={() => choose(createRejectAllConsent())}
          onSave={(choice) => choose({ necessary: true, ...choice })}
        />
      ) : null}
      {consent === undefined ? null : (
        <EnterpriseAnalyticsIsland
          analyticsAllowed={consent?.analytics === true}
          advertisingAllowed={consent?.advertising === true}
        />
      )}
    </>
  );
}
