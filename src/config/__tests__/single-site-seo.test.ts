import { describe, expect, it } from "vitest";
import {
  getSingleSitePublicStaticPages,
  SINGLE_SITE_ROBOTS_DISALLOW_PATHS,
} from "@/config/single-site-seo";

describe("single-site SEO", () => {
  it("owns only the six core static pages", () => {
    expect(getSingleSitePublicStaticPages()).toEqual([
      "",
      "/products",
      "/about",
      "/contact",
      "/privacy",
      "/terms",
    ]);
  });

  it("keeps private runtime paths out of indexing", () => {
    // /_next/ 必须保持可抓取：Googlebot 渲染依赖 /_next/static 资产。
    expect(SINGLE_SITE_ROBOTS_DISALLOW_PATHS).toEqual(["/api/"]);
  });
});
