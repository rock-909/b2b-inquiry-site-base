import type { ProductMarketSlug } from "@/constants/product-catalog";

/**
 * Canonical single-site page-expression inputs.
 *
 * Keep reusable page-expression inputs here:
 * - FAQ item keys
 * - card order / display mapping
 * - CTA targets
 * - supported standards / scope keys / process-step counts
 * - fallback copy
 *
 * Keep implementation details out of here:
 * - route-local message composition and presenter data
 * - product route-local spec lookup maps
 * - `privacy` / `terms` heading-prefix constants
 * - `slugify`, heading parsers, JSON-LD object literals, and page-local helpers
 */

export const SINGLE_SITE_HOME_SECTION_ORDER = [
  "hero",
  "productLines",
  "howToChoose",
  "buyingProcess",
  "buyerSegments",
  "verify",
  "faq",
  "finalCta",
] as const;

export type SingleSiteHomeSectionKey =
  (typeof SINGLE_SITE_HOME_SECTION_ORDER)[number];

export const SINGLE_SITE_HOME_PRODUCT_LINES = [
  {
    key: "absFloodBarriers",
    slug: "abs-flood-barriers",
  },
  {
    key: "aluminumFloodGates",
    slug: "aluminum-flood-gates",
  },
  {
    key: "absorbentFloodBags",
    slug: "absorbent-flood-bags",
  },
  {
    key: "floodTubeDams",
    slug: "flood-tube-dams",
  },
  {
    key: "frpFloodBarriers",
    slug: "frp-flood-barriers",
    hasBadge: true,
  },
] as const satisfies readonly {
  key: string;
  slug: ProductMarketSlug;
  hasBadge?: true;
}[];

export const SINGLE_SITE_HOME_BUYER_SEGMENT_KEYS = [
  "dealersDistributors",
  "importersBrands",
  "contractorsProjects",
  "smallBusinessBuyers",
] as const;

export const SINGLE_SITE_HOME_BUYING_PROCESS_STEP_KEYS = [
  "sendRfq",
  "quoteResponse",
  "paidSample",
  "productionQc",
  "shipment",
] as const;

/** Q5 summary on home: how a buyer verifies us without leaving the page flow. */
export const SINGLE_SITE_HOME_VERIFY_ITEM_KEYS = [
  "audits",
  "samples",
  "inspection",
] as const;

export const SINGLE_SITE_HOME_HOW_TO_CHOOSE_ROW_KEYS = [
  "openings",
  "perimeters",
  "emergency",
  "longRuns",
  "coastal",
] as const;

export const SINGLE_SITE_HOME_FAQ_ITEM_KEYS = [
  "minimumOrder",
  "quoteSpeed",
  "paymentTerms",
  "samples",
  "oem",
  "warranty",
  "leadTime",
  "madeInChina",
  "audit",
] as const;

export const SINGLE_SITE_HOME_HERO_PROOF_ITEMS = [
  "quoteSla",
  "warranty",
  "factoryPool",
  "oem",
] as const;
