export const ATTRIBUTION_FIELD_NAMES = [
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmTerm",
  "utmContent",
  "gclid",
  "fbclid",
  "msclkid",
  "landingPage",
  "capturedAt",
] as const;

export type AttributionFieldName = (typeof ATTRIBUTION_FIELD_NAMES)[number];

export interface MarketingAttributionFields {
  utmSource?: string | undefined;
  utmMedium?: string | undefined;
  utmCampaign?: string | undefined;
  utmTerm?: string | undefined;
  utmContent?: string | undefined;
  gclid?: string | undefined;
  fbclid?: string | undefined;
  msclkid?: string | undefined;
  landingPage?: string | undefined;
  capturedAt?: string | undefined;
}

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

export function pickAttributionFieldsFromFormData(
  formData: FormData,
): MarketingAttributionFields {
  const fields: MarketingAttributionFields = {};

  for (const fieldName of ATTRIBUTION_FIELD_NAMES) {
    const value = formData.get(fieldName);
    if (typeof value === "string" && value.trim()) {
      fields[fieldName] = value.trim();
    }
  }

  return fields;
}
