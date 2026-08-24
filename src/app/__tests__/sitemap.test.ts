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
    expect(byPath["/products/sample-offering"]?.lastModified).toEqual(
      new Date("2026-08-12T00:00:00Z"),
    );
    for (const path of ["/about", "/contact", "/privacy", "/terms"]) {
      expect(byPath[path]?.lastModified).toBeInstanceOf(Date);
    }
  });
});
