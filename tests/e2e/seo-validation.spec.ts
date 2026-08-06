import { expect, test } from "@playwright/test";

const pages = [
  "/",
  "/about",
  "/contact",
  "/products/abs-flood-barriers",
  "/guides/flood-barrier-materials-guide",
] as const;

function collectSchemaTypes(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

test.describe("Rendered SEO contract", () => {
  for (const path of pages) {
    test(`${path} exposes canonical English metadata and valid JSON-LD`, async ({
      page,
    }) => {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);

      const title = await page.title();
      expect(title.length).toBeGreaterThan(10);
      expect(title).not.toContain("{{");

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      const canonicalUrl = new URL(
        (await canonical.getAttribute("href")) ?? "",
      );
      expect(canonicalUrl.pathname).toBe(path);
      expect(canonicalUrl.pathname).not.toMatch(/^\/en(?:\/|$)/u);

      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        "content",
        /.+/,
      );
      await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
        "content",
        /.+/,
      );
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        "content",
        /.+/,
      );

      const enAlternate = page.locator('link[rel="alternate"][hreflang="en"]');
      const defaultAlternate = page.locator(
        'link[rel="alternate"][hreflang="x-default"]',
      );
      await expect(enAlternate).toHaveCount(1);
      await expect(defaultAlternate).toHaveCount(1);
      await expect(
        page.locator('link[rel="alternate"][hreflang="zh"]'),
      ).toHaveCount(0);
      expect(
        new URL((await enAlternate.getAttribute("href")) ?? "").pathname,
      ).toBe(path);
      expect(
        new URL((await defaultAlternate.getAttribute("href")) ?? "").pathname,
      ).toBe(path);

      const scripts = page.locator('script[type="application/ld+json"]');
      expect(await scripts.count()).toBeGreaterThan(0);
      const schemaTypes = new Set<string>();
      for (const raw of await scripts.allTextContents()) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const nodes = Array.isArray(parsed["@graph"])
          ? parsed["@graph"]
          : [parsed];
        for (const node of nodes) {
          if (typeof node !== "object" || node === null) continue;
          for (const type of collectSchemaTypes(
            (node as Record<string, unknown>)["@type"],
          )) {
            schemaTypes.add(type);
          }
        }
      }
      expect(schemaTypes).toContain("Organization");
      expect(schemaTypes).toContain("WebSite");
    });
  }
});
