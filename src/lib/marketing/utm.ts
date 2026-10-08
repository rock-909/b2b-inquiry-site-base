"use client";

import {
  ATTRIBUTION_FIELD_NAMES,
  type MarketingAttributionFields,
} from "@/lib/marketing/attribution-fields";

const UTM_STORAGE_KEY = "inquiry_attribution";

function sanitizeParam(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, 256);
  if (!trimmed) return undefined;
  // Allow printable ASCII while blocking control chars and dangerous HTML delimiters.
  return /^[\x20-\x7E]+$/.test(trimmed) && !/[<>"'`\\]/.test(trimmed)
    ? trimmed
    : undefined;
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

  return params;
}

export function storeAttributionData(): void {
  if (typeof window === "undefined") return;

  // First-touch: only store if no existing data
  const existing = sessionStorage.getItem(UTM_STORAGE_KEY);
  if (existing) return;

  const utmParams = captureUtmParams();

  // Only store if we have any attribution data
  if (!Object.values(utmParams).some(Boolean)) return;

  // Safe: UTM values are derived from sanitizeParam(), which blocks control chars and dangerous HTML delimiters.
  const data: MarketingAttributionFields = {
    ...utmParams,
    landingPage: window.location.pathname,
    capturedAt: new Date().toISOString(),
  };

  sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(data));
}

export function getAttributionSnapshot(): MarketingAttributionFields {
  if (typeof window === "undefined") return {};

  try {
    const parsed: unknown = JSON.parse(
      sessionStorage.getItem(UTM_STORAGE_KEY) ?? "null",
    );
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return captureUtmParams();
    }
    const result: MarketingAttributionFields = {};
    for (const fieldName of ATTRIBUTION_FIELD_NAMES) {
      const value = (parsed as Record<string, unknown>)[fieldName];
      const sanitized = sanitizeParam(typeof value === "string" ? value : null);
      if (sanitized) result[fieldName] = sanitized;
    }
    return result;
  } catch {
    // Ignore parse errors
  }

  // Fallback to current URL params if no stored data
  return captureUtmParams();
}
