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

// 归因值字符规则，浏览器捕获和服务端入口共用：允许可打印 ASCII 和 Unicode
// 字母、组合符号、数字（如 "promoción"），拦截控制/格式字符和危险的 HTML 分隔符。
export function isSafeAttributionValue(value: string): boolean {
  return (
    /^[\x20-\x7E\p{L}\p{M}\p{N}]+$/u.test(value) && !/[<>"'`\\]/.test(value)
  );
}

export function pickAttributionFields(
  source: object,
): MarketingAttributionFields {
  const data = source as Record<string, unknown>;
  const fields: MarketingAttributionFields = {};

  for (const fieldName of ATTRIBUTION_FIELD_NAMES) {
    const value = data[fieldName];
    // 不合规的值整项丢弃而不是拒绝询盘，与浏览器捕获一致。
    if (typeof value === "string" && isSafeAttributionValue(value.trim())) {
      fields[fieldName] = value.trim();
    }
  }

  return fields;
}
