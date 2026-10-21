"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import {
  getPublicRuntimeEnvString,
  isPublicRuntimeProduction,
} from "@/lib/public-runtime-env";
import { trackContactClick } from "@/lib/marketing/lead-event";

type ConsentChoice = { analytics: boolean; advertising: boolean };

// Consent Mode v2：analytics 控制 analytics_storage，advertising 同时控制三个广告信号。
function consentSignals({
  analytics,
  advertising,
}: ConsentChoice): Record<string, string> {
  const analyticsValue = analytics ? "granted" : "denied";
  const advertisingValue = advertising ? "granted" : "denied";
  return {
    analytics_storage: analyticsValue,
    ad_storage: advertisingValue,
    ad_user_data: advertisingValue,
    ad_personalization: advertisingValue,
  };
}

// 撤回或拒绝分析后删掉已写入的 GA cookie（_ga 与 _ga_<ID 去掉 G->）。GA 默认写在可写的最高一级域名上，
// 逐级尝试主机名的每个后缀即可覆盖，不需要公共后缀表；浏览器会忽略公共后缀上的写入。
function expireGaCookies(measurementId: string): void {
  const labels = window.location.hostname.split(".");
  const domains = [
    "",
    ...labels.map((_, index) => `; domain=${labels.slice(index).join(".")}`),
  ];
  for (const name of ["_ga", `_ga_${measurementId.replace(/^G-/u, "")}`]) {
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
    }
  }
}

function ensureGa4QueueInitialized(
  measurementId: string,
  choice: ConsentChoice,
): void {
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
  window.gtag(
    "consent",
    "default",
    consentSignals({ analytics: false, advertising: false }),
  );
  window.gtag("consent", "update", consentSignals(choice));
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    page_path: window.location.pathname,
    send_page_view: false,
  });
}

export function EnterpriseAnalyticsIsland({
  analyticsAllowed,
  advertisingAllowed,
}: {
  analyticsAllowed: boolean;
  advertisingAllowed: boolean;
}) {
  const pathname = usePathname();
  const isProd = isPublicRuntimeProduction();
  const gaMeasurementId = getPublicRuntimeEnvString(
    "NEXT_PUBLIC_GA_MEASUREMENT_ID",
  );
  const anyAllowed = analyticsAllowed || advertisingAllowed;
  const gaEnabled = Boolean(gaMeasurementId) && anyAllowed && isProd;
  const gaInitRef = useRef(false);

  /* eslint-disable react-you-might-not-need-an-effect/no-event-handler -- these effects synchronize the external GA runtime after consent and navigation. */
  useEffect(() => {
    if (!gaMeasurementId) return;
    // GA 官方退出开关：撤回同意后已加载的 gtag 也停止发送。
    (window as unknown as Record<string, unknown>)[
      `ga-disable-${gaMeasurementId}`
    ] = !analyticsAllowed;
    if (!analyticsAllowed) expireGaCookies(gaMeasurementId);
  }, [analyticsAllowed, gaMeasurementId]);

  useEffect(() => {
    // 已初始化的 gtag 在撤回或重新同意时同步 Consent Mode 状态。
    if (!gaInitRef.current) return;
    window.gtag(
      "consent",
      "update",
      consentSignals({
        analytics: analyticsAllowed,
        advertising: advertisingAllowed,
      }),
    );
  }, [analyticsAllowed, advertisingAllowed]);

  useEffect(() => {
    if (!gaEnabled || gaInitRef.current) return;
    ensureGa4QueueInitialized(gaMeasurementId!, {
      analytics: analyticsAllowed,
      advertising: advertisingAllowed,
    });
    gaInitRef.current = true;
  }, [gaEnabled, gaMeasurementId, analyticsAllowed, advertisingAllowed]);

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

  useEffect(() => {
    // 联系方式点击统计只在同意分析后挂载；撤回同意时随之卸载。
    if (!gaEnabled || !analyticsAllowed) return undefined;
    const onClick = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (link) trackContactClick(link.getAttribute("href") ?? "");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [gaEnabled, analyticsAllowed]);
  /* eslint-enable react-you-might-not-need-an-effect/no-event-handler -- the exception ends after the GA synchronization effects. */

  if (!anyAllowed) return null;

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
