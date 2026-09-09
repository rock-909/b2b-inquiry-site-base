import { describe, expect, it } from "vitest";
import { getStaticPage } from "@/lib/content/static-pages";
import { getCanonicalPath } from "@/config/paths/utils";
import {
  SINGLE_SITE_PUBLIC_STATIC_PAGE_ROUTES,
  SINGLE_SITE_PUBLIC_STATIC_PAGES,
} from "@/config/single-site-seo";
import {
  getStaticContentPageLastModified,
  isStaticContentPage,
} from "@/lib/content/page-dates";
describe("page-dates", () => {
  it("does not let an invalid locale date poison the sitemap date", async () => {
    const metadata = getStaticPage("about", "es").metadata;
    const original = metadata.updatedAt;
    try {
      metadata.updatedAt = "not-a-date";
      await expect(getStaticContentPageLastModified("/about")).resolves.toEqual(
        new Date("2026-08-06T00:00:00Z"),
      );
    } finally {
      if (original === undefined) delete metadata.updatedAt;
      else metadata.updatedAt = original;
    }
  });

  it("keeps sitemap content page detection aligned with public static routes", () => {
    const pagesWithoutStaticContent = new Set([
      "",
      getCanonicalPath("products"),
    ]);
    const representativePageContracts = [
      { path: "", hasStaticContent: false },
      { path: "/about", hasStaticContent: true },
      { path: "/contact", hasStaticContent: true },
      { path: "/privacy", hasStaticContent: true },
      { path: "/terms", hasStaticContent: true },
      { path: "/products", hasStaticContent: false },
    ] as const;

    for (const pagePath of SINGLE_SITE_PUBLIC_STATIC_PAGES) {
      expect(isStaticContentPage(pagePath)).toBe(
        !pagesWithoutStaticContent.has(pagePath),
      );
    }

    for (const { path, hasStaticContent } of representativePageContracts) {
      expect(isStaticContentPage(path)).toBe(hasStaticContent);
    }

    expect(SINGLE_SITE_PUBLIC_STATIC_PAGE_ROUTES).toEqual([
      "home",
      "products",
      "about",
      "contact",
      "privacy",
      "terms",
    ]);
  });

  it("loads updatedAt from the statically imported en-only content", async () => {
    const lastModified = await getStaticContentPageLastModified(
      getCanonicalPath("about"),
    );

    expect(lastModified).toEqual(new Date("2026-08-06T00:00:00Z"));
  });

  it("rejects paths that are not mapped from a static route id", async () => {
    await expect(getStaticContentPageLastModified("/unknown")).rejects.toThrow(
      "No static content slug mapping for path: /unknown",
    );
  });

  it("keeps legal page metadata dates present for en-only content", async () => {
    const legalPages = [
      { locale: "en", slug: "privacy" },
      { locale: "en", slug: "terms" },
    ] as const;

    for (const { locale, slug } of legalPages) {
      const lastModified = await getStaticContentPageLastModified(
        getCanonicalPath(slug),
      );
      expect(lastModified, `${locale}/${slug}`).toEqual(
        new Date("2026-08-06T00:00:00Z"),
      );
    }
  });
});
