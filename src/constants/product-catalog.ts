/**
 * Product catalog query facade.
 *
 * Catalog route/list truth stays in src/config/single-site-product-catalog.ts.
 * Current Tucsenberg product page specs/copy live in
 * src/constants/tucsenberg-product-page-*.ts and
 * src/constants/tucsenberg-product-pages.ts.
 */

import {
  singleSiteProductCatalog,
  type ProductMarketSlug,
} from "@/config/single-site-product-catalog";
import type { MarketDefinition, ProductCatalog } from "@/config/site-types";

export type { MarketDefinition, ProductCatalog, ProductMarketSlug };

export const PRODUCT_CATALOG: ProductCatalog = singleSiteProductCatalog;

/** Type guard for catalog product ids (market slugs). */
export function isProductMarketSlug(value: string): value is ProductMarketSlug {
  return singleSiteProductCatalog.markets.some(
    (market) => market.slug === value,
  );
}

/** Get a market definition by its URL slug */
export function getMarketBySlug(slug: string): MarketDefinition | undefined {
  return PRODUCT_CATALOG.markets.find((market) => market.slug === slug);
}

/** Return all market slugs for static generation */
export function getAllMarketSlugs(): readonly string[] {
  return PRODUCT_CATALOG.markets.map((market) => market.slug);
}
