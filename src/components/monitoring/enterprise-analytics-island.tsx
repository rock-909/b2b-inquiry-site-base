"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import {
  getPublicRuntimeEnvString,
  isPublicRuntimeProduction,
} from "@/lib/public-runtime-env";

function ensureGa4QueueInitialized(measurementId: string): void {
  if (!Array.isArray(window.dataLayer)) {
    window.dataLayer = [];
  }
  if (typeof window.gtag !== "function") {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer.push(args);
    };
  }
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    page_path: window.location.pathname,
    send_page_view: false,
  });
}

export function EnterpriseAnalyticsIsland({
  analyticsAllowed,
}: {
  analyticsAllowed: boolean;
}) {
  const pathname = usePathname();
  const isProd = isPublicRuntimeProduction();
  const gaMeasurementId = getPublicRuntimeEnvString(
    "NEXT_PUBLIC_GA_MEASUREMENT_ID",
  );
  const gaEnabled = Boolean(gaMeasurementId) && analyticsAllowed && isProd;
  const gaInitRef = useRef(false);

  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler -- these effects synchronize the external GA runtime after consent and navigation. */
  useEffect(() => {
    if (!gaEnabled || gaInitRef.current) return;
    ensureGa4QueueInitialized(gaMeasurementId!);
    gaInitRef.current = true;
  }, [gaEnabled, gaMeasurementId]);

  useEffect(() => {
    if (!gaEnabled || typeof window.gtag !== "function") return;
    // S-F02：pageview 只上报去 query/hash 的 URL。query 可能携带买家预填、
    // 邮箱等会话上下文，不该流向第三方分析；page_location 必须显式覆写，
    // 留空时 GA4 会回退读取 document.location，照样把 query 带出去。
    window.gtag("config", gaMeasurementId!, {
      page_path: pathname,
      page_location: `${window.location.origin}${pathname}`,
    });
  }, [pathname, gaEnabled, gaMeasurementId]);
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler -- the exception ends after the GA synchronization effects. */

  if (!analyticsAllowed) return null;

  return (
    <>
      {gaEnabled && (
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
          strategy="afterInteractive"
        />
      )}
    </>
  );
}
