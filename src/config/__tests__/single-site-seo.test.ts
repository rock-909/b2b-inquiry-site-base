import { describe, expect, it } from "vitest";
import { getProductMarketPath } from "@/config/paths/utils";
import {
  getSingleSiteSitemapPageConfigByPath,
  getSingleSiteStaticPageLastmod,
  hasSingleSiteDynamicSurface,
  SINGLE_SITE_ROBOTS_DISALLOW_PATHS,
} from "@/config/single-site-seo";
import { TUCSENBERG_PRODUCT_PAGES } from "@/constants/tucsenberg-product-pages";

describe("single-site-seo", () => {
  it("derives product page lastmod from the live catalog", () => {
    const catalogLastmod = getSingleSiteStaticPageLastmod();
    for (const productPage of Object.values(TUCSENBERG_PRODUCT_PAGES)) {
      expect(catalogLastmod[getProductMarketPath(productPage.slug)]).toBe(
        productPage.meta.updatedAt,
      );
    }
  });

  it("keeps private runtime paths out of search indexing", () => {
    expect(SINGLE_SITE_ROBOTS_DISALLOW_PATHS).toEqual(["/api/", "/_next/"]);
  });

  it("owns the product-market dynamic surface and no blog surface", () => {
    expect(hasSingleSiteDynamicSurface("productMarket")).toBe(true);
    expect(getSingleSiteSitemapPageConfigByPath().productMarket).toEqual({
      changeFrequency: "weekly",
      priority: 0.8,
    });
    expect(getSingleSiteSitemapPageConfigByPath().blogArticle).toBeUndefined();
  });
});
