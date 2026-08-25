import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { OFFERINGS } from "@/config/offerings";

describe("sitemap", () => {
  it("contains the public pages and configured product routes once", async () => {
    const entries = await sitemap();
    const paths = entries.map((entry) => new URL(entry.url).pathname);

    expect(paths).toEqual([
      "/",
      "/products",
      "/products/sample-offering",
      "/about",
      "/contact",
      "/privacy",
      "/terms",
    ]);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("only publishes supported lastmod values", async () => {
    const entries = await sitemap();
    const byPath = Object.fromEntries(
      entries.map((entry) => [new URL(entry.url).pathname, entry]),
    );

    for (const entry of entries) {
      expect(entry.priority).toBeGreaterThan(0);
      expect(entry.alternates?.languages).toHaveProperty("en");
      expect(entry.alternates?.languages).toHaveProperty("x-default");
    }

    expect(byPath["/"]).not.toHaveProperty("lastModified");
    expect(byPath["/products"]).not.toHaveProperty("lastModified");
    // 验证接线（lastmod 来自 offering.updatedAt），不锁死具体日期字面量：
    // 业主更新内容并 bump updatedAt 时测试仍然有效。
    expect(byPath["/products/sample-offering"]?.lastModified).toEqual(
      new Date(OFFERINGS[0]!.updatedAt),
    );
    for (const path of ["/about", "/contact", "/privacy", "/terms"]) {
      expect(byPath[path]?.lastModified).toBeInstanceOf(Date);
    }
  });
});
