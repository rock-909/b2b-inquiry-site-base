const ATTRIBUTION_PARAM_PATTERN = /(?:^|[?&])utm_/i;

export function loadAttributionModule() {
  return import("@/lib/marketing/utm");
}

export function shouldLoadAttribution(search: string) {
  return ATTRIBUTION_PARAM_PATTERN.test(search);
}
