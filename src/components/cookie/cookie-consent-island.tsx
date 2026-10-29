"use client";

import dynamic from "next/dynamic";
import { isConsentBannerEnabled } from "@/lib/cookie-consent/banner";

// 未配置 GA 时不渲染就不会下载同意横幅与 GA 代码；已配置时行为不变。
const CookieConsentController = dynamic(() =>
  import("@/components/cookie/cookie-consent-controller").then(
    (module) => module.CookieConsentController,
  ),
);

export function CookieConsentIsland() {
  return isConsentBannerEnabled() ? <CookieConsentController /> : null;
}
