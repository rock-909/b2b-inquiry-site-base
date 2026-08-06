const ATTRIBUTION_PARAM_PATTERN = /(?:^|[?&])(utm_|gclid=|fbclid=|msclkid=)/i;
const ATTRIBUTION_FLUSH_EVENTS = ["storage", "visibilitychange"] as const;

export type AttributionModule = Pick<
  typeof import("@/lib/marketing/utm"),
  "flushPendingAttribution" | "storeAttributionData"
>;
export type AttributionModuleLoader = () => Promise<AttributionModule>;
export type AttributionFlushHandler =
  AttributionModule["flushPendingAttribution"];

export function loadAttributionModule() {
  return import("@/lib/marketing/utm");
}

export function shouldLoadAttribution(search: string) {
  return ATTRIBUTION_PARAM_PATTERN.test(search);
}

export function registerAttributionFlushListeners(
  flushPendingAttribution: AttributionFlushHandler,
) {
  for (const eventName of ATTRIBUTION_FLUSH_EVENTS) {
    window.addEventListener(eventName, flushPendingAttribution);
  }

  return () => {
    for (const eventName of ATTRIBUTION_FLUSH_EVENTS) {
      window.removeEventListener(eventName, flushPendingAttribution);
    }
  };
}
