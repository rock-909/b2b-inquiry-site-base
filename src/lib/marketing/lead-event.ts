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

  window.gtag("event", "generate_lead", eventParams);
}
