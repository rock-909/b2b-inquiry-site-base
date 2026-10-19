import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { PUBLIC_STATIC_PAGE_DEFINITIONS } from "@/config/pages.config";
import { getLocalePath, LOCALES_CONFIG } from "@/config/paths";

const { defaultLocale, locales } = LOCALES_CONFIG;

describe("sitemap", () => {
  it("publishes each indexable page in every locale once", async () => {
    const entries = await sitemap();
    const paths = entries.map((entry) => new URL(entry.url).pathname);
    const pages = PUBLIC_STATIC_PAGE_DEFINITIONS.filter(
      (page) => page.sitemap.include,
    );
    expect(pages.length).toBeGreaterThan(0);
    expect(paths).toEqual(
      locales.flatMap((locale) =>
        pages.map((page) => getLocalePath(locale, page.path)),
      ),
    );
    expect(new Set(paths).size).toBe(paths.length);
    // 独立锚点：默认语言的首页不带前缀。
    expect(paths[0]).toBe("/");
    for (const page of PUBLIC_STATIC_PAGE_DEFINITIONS) {
      if (page.sitemap.include) continue;
      for (const locale of locales)
        expect(paths).not.toContain(getLocalePath(locale, page.path));
    }
  });

  it("publishes reciprocal alternates and content dates only for content pages", async () => {
    const entries = await sitemap();
    const pages = PUBLIC_STATIC_PAGE_DEFINITIONS.filter(
      (page) => page.sitemap.include,
    );
    const contentPathnames = new Set(
      locales.flatMap((locale) =>
        pages
          .filter((page) => page.contentSlug !== null)
          .map((page) => getLocalePath(locale, page.path)),
      ),
    );
    for (const entry of entries) {
      expect(entry).not.toHaveProperty("priority");
      expect(entry).not.toHaveProperty("changeFrequency");
      for (const locale of locales) {
        expect(entry.alternates?.languages).toHaveProperty(locale);
      }
      expect(entry.alternates?.languages?.["x-default"]).toBe(
        entry.alternates?.languages?.[defaultLocale],
      );
      if (contentPathnames.has(new URL(entry.url).pathname))
        expect(entry.lastModified).toBeInstanceOf(Date);
      else expect(entry).not.toHaveProperty("lastModified");
    }
  });
});
