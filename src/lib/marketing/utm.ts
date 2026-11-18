"use client";

import { isConsentBannerEnabled } from "@/lib/cookie-consent/banner";
import { loadConsent } from "@/lib/cookie-consent/storage";
import {
  ATTRIBUTION_FIELD_NAMES,
  CLICK_ID_FIELD_NAMES,
  CLICK_ID_PATTERN,
  isClickIdField,
  type ClickIdFieldName,
  isSafeAttributionValue,
  type MarketingAttributionFields,
} from "@/lib/marketing/attribution-fields";

const UTM_STORAGE_KEY = "inquiry_attribution";

type ClickIds = Partial<Record<ClickIdFieldName, string>>;

// 买家还没选择时落地带来的点击 ID 只暂存在页面内存里，同意广告后再补存；不写任何浏览器存储。
let pendingClickIds: ClickIds = {};

// 点击 ID 只在买家同意广告时保存和发送；没配 GA 的站没有同意卡，一律不采集。
function isAdvertisingAllowed(): boolean {
  return (
    isConsentBannerEnabled() && loadConsent()?.consent.advertising === true
  );
}

function hasConsentDecision(): boolean {
  return isConsentBannerEnabled() && loadConsent() !== null;
}

function splitClickIds(fields: MarketingAttributionFields): {
  source: MarketingAttributionFields;
  clickIds: ClickIds;
} {
  const source: MarketingAttributionFields = { ...fields };
  const clickIds: ClickIds = {};
  for (const fieldName of CLICK_ID_FIELD_NAMES) {
    const value = source[fieldName];
    if (value) clickIds[fieldName] = value;
    delete source[fieldName];
  }
  return { source, clickIds };
}

function withoutClickIdsUnlessAllowed(
  fields: MarketingAttributionFields,
): MarketingAttributionFields {
  return isAdvertisingAllowed() ? fields : splitClickIds(fields).source;
}

function readStoredRecord(): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(
      sessionStorage.getItem(UTM_STORAGE_KEY) ?? "null",
    );
    return parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * 按当前广告同意同步点击 ID：同意时补存页面内存里暂存的点击 ID；
 * 拒绝时丢掉暂存；拒绝或撤回时从已保存的来源记录里只删点击 ID，来源信息保留。
 */
export function syncClickIdConsent(): void {
  if (typeof window === "undefined") return;

  const stored = readStoredRecord();
  if (isAdvertisingAllowed()) {
    if (stored && Object.keys(pendingClickIds).length > 0) {
      sessionStorage.setItem(
        UTM_STORAGE_KEY,
        JSON.stringify({ ...stored, ...pendingClickIds }),
      );
    }
    pendingClickIds = {};
    return;
  }

  // 还没选择时保留暂存，等买家同意；已经拒绝（或站点没有同意卡）就丢掉。
  if (!isConsentBannerEnabled() || hasConsentDecision()) pendingClickIds = {};
  removeStoredClickIds(stored);
}

// 只从已保存的来源记录里删点击 ID，来源信息和落地页保留。
function removeStoredClickIds(stored: Record<string, unknown> | null): void {
  if (stored && CLICK_ID_FIELD_NAMES.some((fieldName) => fieldName in stored)) {
    const sourceOnly = { ...stored };
    for (const fieldName of CLICK_ID_FIELD_NAMES) delete sourceOnly[fieldName];
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(sourceOnly));
  }
}

function removeStoredClickIdsUnlessAllowed(): void {
  if (!isAdvertisingAllowed()) removeStoredClickIds(readStoredRecord());
}

function sanitizeParam(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, 256);
  if (!trimmed) return undefined;
  return isSafeAttributionValue(trimmed) ? trimmed : undefined;
}

// 截断后的点击 ID 没有用，所以点击 ID 整体校验，不截到 256。
function sanitizeClickId(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed && CLICK_ID_PATTERN.test(trimmed) ? trimmed : undefined;
}

export function captureUtmParams(): MarketingAttributionFields {
  if (typeof window === "undefined") return {};

  const searchParams = new URLSearchParams(window.location.search);
  const params: MarketingAttributionFields = {};

  // Use explicit property assignment to avoid object injection
  const utmSource = sanitizeParam(searchParams.get("utm_source"));
  const utmMedium = sanitizeParam(searchParams.get("utm_medium"));
  const utmCampaign = sanitizeParam(searchParams.get("utm_campaign"));
  const utmTerm = sanitizeParam(searchParams.get("utm_term"));
  const utmContent = sanitizeParam(searchParams.get("utm_content"));

  if (utmSource) params.utmSource = utmSource;
  if (utmMedium) params.utmMedium = utmMedium;
  if (utmCampaign) params.utmCampaign = utmCampaign;
  if (utmTerm) params.utmTerm = utmTerm;
  if (utmContent) params.utmContent = utmContent;
  for (const fieldName of CLICK_ID_FIELD_NAMES) {
    const clickId = sanitizeClickId(searchParams.get(fieldName));
    if (clickId) params[fieldName] = clickId;
  }

  return params;
}

export function storeAttributionData(): void {
  if (typeof window === "undefined") return;

  removeStoredClickIdsUnlessAllowed();

  // First-touch: only store if no existing data
  const existing = sessionStorage.getItem(UTM_STORAGE_KEY);
  if (existing) return;

  const utmParams = captureUtmParams();

  // Only store if we have any attribution data
  if (!Object.values(utmParams).some(Boolean)) return;

  // 来源信息每次照常保存；点击 ID 没有广告同意时先暂存在内存，只有还没选择时才可能补存。
  const { source, clickIds } = splitClickIds(utmParams);
  const allowed = isAdvertisingAllowed();
  pendingClickIds =
    !allowed && isConsentBannerEnabled() && !hasConsentDecision()
      ? clickIds
      : {};

  // Safe: values come from sanitizeParam()/sanitizeClickId(), which block control chars and dangerous HTML delimiters.
  const data: MarketingAttributionFields = {
    ...source,
    ...(allowed ? clickIds : {}),
    landingPage: window.location.pathname,
    capturedAt: new Date().toISOString(),
  };

  sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(data));
}

export function getAttributionSnapshot(): MarketingAttributionFields {
  if (typeof window === "undefined") return {};

  removeStoredClickIdsUnlessAllowed();

  try {
    const parsed: unknown = JSON.parse(
      sessionStorage.getItem(UTM_STORAGE_KEY) ?? "null",
    );
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return withoutClickIdsUnlessAllowed(captureUtmParams());
    }
    const result: MarketingAttributionFields = {};
    for (const fieldName of ATTRIBUTION_FIELD_NAMES) {
      const raw = (parsed as Record<string, unknown>)[fieldName];
      const value = typeof raw === "string" ? raw : null;
      const sanitized = isClickIdField(fieldName)
        ? sanitizeClickId(value)
        : sanitizeParam(value);
      if (sanitized) result[fieldName] = sanitized;
    }
    return withoutClickIdsUnlessAllowed(result);
  } catch {
    // Ignore parse errors
  }

  // Fallback to current URL params if no stored data
  return withoutClickIdsUnlessAllowed(captureUtmParams());
}
