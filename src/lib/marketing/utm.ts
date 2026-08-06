"use client";

import { loadConsent } from "@/lib/cookie-consent/storage";
import { ATTRIBUTION_FIELD_NAMES } from "@/lib/marketing/attribution-fields";

const UTM_STORAGE_KEY = "marketing_attribution";

export interface UtmParams {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

export interface ClickIds {
  gclid?: string;
  fbclid?: string;
  msclkid?: string;
}

export interface AttributionData extends UtmParams, ClickIds {
  landingPage?: string;
  capturedAt?: string;
}

let pendingAttribution: AttributionData | null = null;

function sanitizeParam(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, 256);
  if (!trimmed) return undefined;
  // Allow printable ASCII while blocking control chars and dangerous HTML delimiters.
  return /^[\x20-\x7E]+$/.test(trimmed) && !/[<>"'`\\]/.test(trimmed)
    ? trimmed
    : undefined;
}

function hasMarketingConsent(): boolean {
  return loadConsent()?.consent.marketing === true;
}

export function captureUtmParams(): UtmParams {
  if (typeof window === "undefined") return {};

  const searchParams = new URLSearchParams(window.location.search);
  const params: UtmParams = {};

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

  return params;
}

export function captureClickIds(): ClickIds {
  if (typeof window === "undefined") return {};

  const searchParams = new URLSearchParams(window.location.search);
  const ids: ClickIds = {};

  // Use explicit property assignment to avoid object injection
  const gclid = sanitizeParam(searchParams.get("gclid"));
  const fbclid = sanitizeParam(searchParams.get("fbclid"));
  const msclkid = sanitizeParam(searchParams.get("msclkid"));

  if (gclid) ids.gclid = gclid;
  if (fbclid) ids.fbclid = fbclid;
  if (msclkid) ids.msclkid = msclkid;

  return ids;
}

export function storeAttributionData(): void {
  if (typeof window === "undefined") return;

  // First-touch: only store if no existing data
  const existing = sessionStorage.getItem(UTM_STORAGE_KEY);
  if (existing) return;

  const utmParams = captureUtmParams();
  const clickIds = captureClickIds();

  // Only store if we have any attribution data
  const hasData =
    Object.values(utmParams).some(Boolean) ||
    Object.values(clickIds).some(Boolean);

  if (!hasData) return;

  // Safe: utmParams and clickIds are derived from sanitizeParam(), which blocks control chars and dangerous HTML delimiters.
  const data: AttributionData = {
    ...utmParams,
    ...clickIds,
    landingPage: window.location.pathname,
    capturedAt: new Date().toISOString(),
  };

  if (hasMarketingConsent()) {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(data));
  } else {
    pendingAttribution = data;
  }
}

export function flushPendingAttribution(): void {
  if (typeof window === "undefined" || !pendingAttribution) return;
  if (!hasMarketingConsent()) return;

  const existing = sessionStorage.getItem(UTM_STORAGE_KEY);
  if (existing) {
    pendingAttribution = null;
    return;
  }

  sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(pendingAttribution));
  pendingAttribution = null;
}

export function getAttributionSnapshot(): AttributionData {
  if (typeof window === "undefined") return {};

  try {
    const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as AttributionData;
    }
  } catch {
    // Ignore parse errors
  }

  if (pendingAttribution) return pendingAttribution;

  // Fallback to current URL params if no stored data
  // Safe: captureUtmParams/captureClickIds return sanitized objects with printable ASCII values minus dangerous HTML delimiters.
  return {
    ...captureUtmParams(),
    ...captureClickIds(),
  };
}

export function getAttributionAsObject(): Record<string, string> {
  const attribution = getAttributionSnapshot();
  const result: Record<string, string> = {};

  for (const fieldName of ATTRIBUTION_FIELD_NAMES) {
    const value = attribution[fieldName];
    if (value) {
      result[fieldName] = value;
    }
  }

  return result;
}

export function appendAttributionToFormData(formData: FormData): void {
  for (const [key, value] of Object.entries(getAttributionAsObject())) {
    formData.append(key, value);
  }
}
