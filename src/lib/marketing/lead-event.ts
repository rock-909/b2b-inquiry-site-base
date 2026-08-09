"use client";

import type { GtagEventParams } from "@/lib/analytics/gtag";

export type LeadEventMethod = "contact" | "rfq";

export function trackGenerateLead(method: LeadEventMethod): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  const eventParams = {
    event_category: "lead",
    method,
  } satisfies GtagEventParams;

  try {
    window.gtag("event", "generate_lead", eventParams);
  } catch {
    // 分析脚本失败不能改变已经成功的询盘结果。
  }
}
