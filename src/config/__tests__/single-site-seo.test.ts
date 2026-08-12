import { describe, expect, it } from "vitest";
import {
  getSingleSitePublicStaticPages,
  getSingleSiteStaticPageLastmod,
  SINGLE_SITE_ROBOTS_DISALLOW_PATHS,
} from "@/config/single-site-seo";

describe("single-site SEO", () => {
  it("owns only the seven core static pages", () => {
    expect(getSingleSitePublicStaticPages()).toEqual([
      "",
      "/products",
      "/about",
      "/request-quote",
      "/contact",
      "/privacy",
      "/terms",
    ]);
  });

  it("keeps static lastmod only for non-MDX pages", () => {
    expect(getSingleSiteStaticPageLastmod()).toEqual({
      "": "2026-07-05T00:00:00Z",
      "/products": "2026-08-12T00:00:00Z",
      "/request-quote": "2026-07-05T00:00:00Z",
    });
  });

  it("keeps private runtime paths out of indexing", () => {
    expect(SINGLE_SITE_ROBOTS_DISALLOW_PATHS).toEqual(["/api/", "/_next/"]);
  });
});
