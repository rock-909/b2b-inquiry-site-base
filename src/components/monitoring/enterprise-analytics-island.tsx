"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import {
  getPublicRuntimeEnvString,
  isPublicRuntimeProduction,
} from "@/lib/public-runtime-env";

// Consent Mode v2 的四个信号统一跟随横幅上的 analytics 选择。
function consentSignals(granted: boolean): Record<string, string> {
  const value = granted ? "granted" : "denied";
  return {
    analytics_storage: value,
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
  };
}

function ensureGa4QueueInitialized(measurementId: string): void {
  if (!Array.isArray(window.dataLayer)) {
    window.dataLayer = [];
  }
  if (typeof window.gtag !== "function") {
    // gtag.js 只把 Arguments 对象当作命令（Google 官方代码片段写法），普通数组会被忽略。
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params -- gtag.js 要求推入 arguments 对象本身
      window.dataLayer.push(arguments);
    };
  }
  // 基础模式：同意后才加载 gtag，按 Google 规定的顺序先 default 拒绝、再 update 授予。
  window.gtag("consent", "default", consentSignals(false));
  window.gtag("consent", "update", consentSignals(true));
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
    if (!gaMeasurementId) return;
    // GA 官方退出开关：撤回同意后已加载的 gtag 也停止发送。
    (window as unknown as Record<string, unknown>)[
      `ga-disable-${gaMeasurementId}`
    ] = !analyticsAllowed;
  }, [analyticsAllowed, gaMeasurementId]);

  useEffect(() => {
    // 已初始化的 gtag 在撤回或重新同意时同步 Consent Mode 状态。
    if (!gaInitRef.current) return;
    window.gtag("consent", "update", consentSignals(analyticsAllowed));
  }, [analyticsAllowed]);

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
