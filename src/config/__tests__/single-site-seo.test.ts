import { describe, expect, it } from "vitest";
import { SINGLE_SITE_ROBOTS_DISALLOW_PATHS } from "@/config/single-site-seo";

describe("single-site SEO", () => {
  it("keeps private runtime paths out of indexing", () => {
    // /_next/ 必须保持可抓取：Googlebot 渲染依赖 /_next/static 资产。
    expect(SINGLE_SITE_ROBOTS_DISALLOW_PATHS).toEqual(["/api/"]);
  });
});
