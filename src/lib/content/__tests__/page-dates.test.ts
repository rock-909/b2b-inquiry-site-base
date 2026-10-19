import { describe, expect, it } from "vitest";
import { getStaticPage } from "@/lib/content/static-pages";
import { PUBLIC_STATIC_PAGE_DEFINITIONS } from "@/config/pages.config";
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import {
  getStaticContentPageLastModified,
  isStaticContentPage,
} from "@/lib/content/page-dates";

const { locales } = LOCALES_CONFIG;
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
  it("skips an invalid date without affecting the other locales", () => {
    const [page] = contentPages;
    const [first, ...rest] = locales;
    const metadata = getStaticPage(page!.slug, first!).metadata;
    const original = metadata.updatedAt;
    try {
      metadata.updatedAt = "not-a-date";
      expect(
        getStaticContentPageLastModified(page!.path, first!),
      ).toBeUndefined();
      for (const locale of rest) {
        expect(getStaticContentPageLastModified(page!.path, locale)).toEqual(
          contentDate(page!.slug, locale),
        );
      }
    } finally {
      if (original === undefined) delete metadata.updatedAt;
      else metadata.updatedAt = original;
    }
  });

  it("detects content pages from the registry's contentSlug", () => {
    for (const page of PUBLIC_STATIC_PAGE_DEFINITIONS) {
      expect(isStaticContentPage(toSitemapPath(page.path)), page.path).toBe(
        page.contentSlug !== null,
      );
    }
    expect(isStaticContentPage("/not-a-registered-page")).toBe(false);
  });

  it("dates every content page from each locale's own content", () => {
    expect(contentPages.length).toBeGreaterThan(0);
    for (const { path, slug } of contentPages) {
      for (const locale of locales) {
        expect(
          getStaticContentPageLastModified(path, locale),
          `${locale}${path}`,
        ).toEqual(contentDate(slug, locale));
      }
    }
  });

  it("rejects paths that are not mapped from a static route id", () => {
    expect(() => getStaticContentPageLastModified("/unknown", "en")).toThrow(
      "No static content slug mapping for path: /unknown",
    );
  });
});
