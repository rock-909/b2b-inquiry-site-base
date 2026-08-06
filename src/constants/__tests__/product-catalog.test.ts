import { describe, expect, it } from "vitest";
import {
  getAllMarketSlugs,
  getMarketBySlug,
  isProductMarketSlug,
  PRODUCT_CATALOG,
} from "@/constants/product-catalog";
import { singleSiteProductCatalog } from "@/config/single-site-product-catalog";

describe("product-catalog wrapper", () => {
  it("uses the single-site catalog as runtime truth during cutover", () => {
    expect(PRODUCT_CATALOG).toBe(singleSiteProductCatalog);
  });

  it("recognizes only current catalog slugs", () => {
    expect(isProductMarketSlug("abs-flood-barriers")).toBe(true);
    expect(isProductMarketSlug("forged-product")).toBe(false);
  });

  it("keeps market lookups aligned with the single-site catalog", () => {
    expect(getMarketBySlug("abs-flood-barriers")?.standardLabel).toBe(
      "TB-BW series",
    );
    expect(getAllMarketSlugs()).toEqual([
      "abs-flood-barriers",
      "aluminum-flood-gates",
      "absorbent-flood-bags",
      "flood-tube-dams",
      "frp-flood-barriers",
    ]);
  });
});
