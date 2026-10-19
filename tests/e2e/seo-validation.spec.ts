import { expect, test } from "@playwright/test";
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import { localizePath, SITE_PAGE_CASES } from "./site-page-cases";

const pages = SITE_PAGE_CASES.map(([path]) => path);

function collectSchemaTypes(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

test.describe("Rendered SEO contract", () => {
  test("the homepage OG image is served as a real image", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    const image = page.locator('meta[property="og:image"]');
    await expect(image).toHaveCount(1);
    const imageUrl = new URL((await image.getAttribute("content"))!);
    // 只验证本地构建服务的资源，不向 canonical 域名发请求。
    const response = await request.get(imageUrl.pathname);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/^image\//);
    expect((await response.body()).length).toBeGreaterThan(0);
  });
  for (const path of pages) {
    test(`${path} exposes canonical default-locale metadata and valid JSON-LD`, async ({
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

      // 每个已配置语种各一条 hreflang 加 x-default，不多不少。
      const alternates = await page
        .locator("link[rel='alternate'][hreflang]")
        .evaluateAll((links) =>
          links.map((link) => [
            link.getAttribute("hreflang"),
            new URL(link.getAttribute("href") ?? "").pathname,
          ]),
        );
      expect(alternates.toSorted()).toEqual(
        [
          ...LOCALES_CONFIG.locales.map((locale) => [
            locale,
            localizePath(locale, path),
          ]),
          ["x-default", path],
        ].toSorted(),
      );

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
      expect(schemaTypes).toContain("WebSite");
    });
  }
});
