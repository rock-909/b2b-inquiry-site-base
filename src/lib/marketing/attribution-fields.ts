export const ATTRIBUTION_FIELD_NAMES = [
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmTerm",
  "utmContent",
  "landingPage",
  "capturedAt",
  "gclid",
] as const;

export type AttributionFieldName = (typeof ATTRIBUTION_FIELD_NAMES)[number];

export interface MarketingAttributionFields {
  utmSource?: string | undefined;
  utmMedium?: string | undefined;
  utmCampaign?: string | undefined;
  utmTerm?: string | undefined;
  utmContent?: string | undefined;
  landingPage?: string | undefined;
  capturedAt?: string | undefined;
  gclid?: string | undefined;
}

// Google Ads 点击 ID 是 URL 安全的 base64 字符；其他字符都不是真实的点击 ID。
export const GCLID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;

export function pickAttributionFields(
  source: object,
): MarketingAttributionFields {
  const data = source as Record<string, unknown>;
  const fields: MarketingAttributionFields = {};

  for (const fieldName of ATTRIBUTION_FIELD_NAMES) {
    const value = data[fieldName];
    if (typeof value === "string" && value.trim()) {
      fields[fieldName] = value.trim();
    }
  }

  return fields;
}
