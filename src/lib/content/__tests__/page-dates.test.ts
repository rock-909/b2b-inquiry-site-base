import { describe, expect, it } from "vitest";
import { getStaticPage } from "@/lib/content/static-pages";
import { PUBLIC_STATIC_PAGE_DEFINITIONS } from "@/config/pages.config";
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import {
  getStaticContentPageLastModified,
  isStaticContentPage,
} from "@/lib/content/page-dates";

const { defaultLocale, locales } = LOCALES_CONFIG;
const toSitemapPath = (path: string) => (path === "/" ? "" : path);
const contentPages = PUBLIC_STATIC_PAGE_DEFINITIONS.flatMap((page) =>
  page.contentSlug === null
    ? []
    : [{ path: toSitemapPath(page.path), slug: page.contentSlug }],
);
const contentDate = (slug: string, locale: (typeof locales)[number]) => {
  const { metadata } = getStaticPage(slug, locale);
  return new Date(metadata.updatedAt ?? metadata.publishedAt);
};

describe("page-dates", () => {
  // 需要至少两种语言才能让一个语言的坏日期与其他语言的好日期并存。
  it.skipIf(locales.length < 2)(
    "does not let an invalid locale date poison the sitemap date",
    async () => {
      const [page] = contentPages;
      const poisoned = locales
        .filter((locale) => locale !== defaultLocale)
        .map((locale) => getStaticPage(page!.slug, locale).metadata);
      const originals = poisoned.map((metadata) => metadata.updatedAt);
      try {
        for (const metadata of poisoned) metadata.updatedAt = "not-a-date";
        await expect(
          getStaticContentPageLastModified(page!.path),
        ).resolves.toEqual(contentDate(page!.slug, defaultLocale));
      } finally {
        poisoned.forEach((metadata, index) => {
          const original = originals[index];
          if (original === undefined) delete metadata.updatedAt;
          else metadata.updatedAt = original;
        });
      }
    },
  );

  it("detects content pages from the registry's contentSlug", () => {
    for (const page of PUBLIC_STATIC_PAGE_DEFINITIONS) {
      expect(isStaticContentPage(toSitemapPath(page.path)), page.path).toBe(
        page.contentSlug !== null,
      );
    }
    expect(isStaticContentPage("/not-a-registered-page")).toBe(false);
  });

  it("uses the latest content date across locales for every content page", async () => {
    expect(contentPages.length).toBeGreaterThan(0);
    for (const { path, slug } of contentPages) {
      const latest = Math.max(
        ...locales.map((locale) => contentDate(slug, locale).getTime()),
      );
      await expect(
        getStaticContentPageLastModified(path),
        path,
      ).resolves.toEqual(new Date(latest));
    }
  });

  it("rejects paths that are not mapped from a static route id", async () => {
    await expect(getStaticContentPageLastModified("/unknown")).rejects.toThrow(
      "No static content slug mapping for path: /unknown",
    );
  });
});
