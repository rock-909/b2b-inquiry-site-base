import type { ProductMarketSlug } from "@/config/single-site-product-catalog";
import {
  MAX_INQUIRY_CONFIG_PREFILL_LENGTH,
  MAX_LEAD_PRODUCT_NAME_LENGTH,
} from "@/constants/validation-limits";
import {
  getMarketBySlug,
  isProductMarketSlug,
} from "@/constants/product-catalog";

function capBuyerInterest(raw: string | null | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed.slice(0, MAX_LEAD_PRODUCT_NAME_LENGTH);
}

function capConfigPrefill(raw: string | null | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed.slice(0, MAX_INQUIRY_CONFIG_PREFILL_LENGTH);
}

export type InquirySearchParams = Record<string, string | string[] | undefined>;

export type ValidatedInquiryContext =
  | {
      kind: "catalog-context";
      catalogProductId: ProductMarketSlug;
      displayLabel: string;
      initialMessage?: string;
    }
  | {
      kind: "general-context";
      buyerInterest?: string;
      initialMessage?: string;
    };

function readOptionalDescription(
  searchParams: InquirySearchParams,
  key: "interest" | "config",
): string | undefined {
  const value = searchParams[key];
  const raw = Array.isArray(value) ? value[0] : value;
  return key === "interest"
    ? capBuyerInterest(raw ?? null)
    : capConfigPrefill(raw ?? null);
}

function readCatalogProductId(
  searchParams: InquirySearchParams,
): ProductMarketSlug | undefined {
  const value = searchParams.catalogProductId;
  if (Array.isArray(value) || typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return isProductMarketSlug(trimmed) ? trimmed : undefined;
}

export function resolveInquiryContext(
  searchParams: InquirySearchParams,
): ValidatedInquiryContext {
  const buyerInterest = readOptionalDescription(searchParams, "interest");
  const initialMessage = readOptionalDescription(searchParams, "config");
  const generalDescriptionFields = {
    ...(buyerInterest ? { buyerInterest } : {}),
    ...(initialMessage ? { initialMessage } : {}),
  };
  const catalogDescriptionFields = {
    ...(initialMessage ? { initialMessage } : {}),
  };

  const catalogProductId = readCatalogProductId(searchParams);
  if (!catalogProductId) {
    return {
      kind: "general-context",
      ...generalDescriptionFields,
    };
  }

  const market = getMarketBySlug(catalogProductId);
  if (!market) {
    return {
      kind: "general-context",
      ...generalDescriptionFields,
    };
  }

  return {
    kind: "catalog-context",
    catalogProductId,
    displayLabel: market.label,
    ...catalogDescriptionFields,
  };
}

export function createCatalogInquiryHref(
  catalogProductId: ProductMarketSlug,
  initialMessage?: string,
): `/request-quote${string}` {
  const params = new URLSearchParams({ catalogProductId });
  const cappedMessage = initialMessage
    ? capConfigPrefill(initialMessage)
    : undefined;

  if (cappedMessage) {
    params.set("config", cappedMessage);
  }

  return `/request-quote?${params.toString()}` as `/request-quote${string}`;
}
