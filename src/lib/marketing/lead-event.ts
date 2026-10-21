"use client";

import type { GtagEventParams } from "@/lib/analytics/gtag";

function sendGtagEvent(eventName: string, eventParams: GtagEventParams): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  try {
    window.gtag("event", eventName, eventParams);
  } catch {
    // 分析脚本失败不能影响买家已经完成的操作（询盘提交、点开联系方式）。
  }
}

export function trackGenerateLead(): void {
  sendGtagEvent("generate_lead", { event_category: "lead" });
}

type ContactChannel = "email" | "phone" | "whatsapp";

const CONTACT_CHANNEL_PATTERNS: ReadonlyArray<[ContactChannel, RegExp]> = [
  ["email", /^mailto:/iu],
  ["phone", /^tel:/iu],
  [
    "whatsapp",
    /^(?:whatsapp:|https:\/\/(?:wa\.me|(?:api|web)\.whatsapp\.com)\/)/iu,
  ],
];

/** 只上报渠道，不上报地址或号码本身。 */
export function trackContactClick(href: string): void {
  const channel = CONTACT_CHANNEL_PATTERNS.find(([, pattern]) =>
    pattern.test(href.trim()),
  )?.[0];
  if (channel) {
    sendGtagEvent("contact_click", { event_category: "lead", channel });
  }
}
