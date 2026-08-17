import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  it("contains the public pages and configured product routes once", async () => {
    const entries = await sitemap();
    const paths = entries.map((entry) => new URL(entry.url).pathname);

    expect(paths).toEqual([
      "/",
      "/products",
      "/products/sample-offering",
      "/about",
      "/request-quote",
      "/contact",
      "/privacy",
      "/terms",
    ]);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("gives every entry lastmod, priority and language alternates", async () => {
    const entries = await sitemap();

    for (const entry of entries) {
      expect(entry.lastModified).toBeInstanceOf(Date);
      expect(entry.priority).toBeGreaterThan(0);
      expect(entry.alternates?.languages).toHaveProperty("en");
      expect(entry.alternates?.languages).toHaveProperty("x-default");
    }
  });
});
