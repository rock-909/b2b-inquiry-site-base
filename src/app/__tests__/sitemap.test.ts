import { describe, expect, it, vi } from "vitest";
import { getCanonicalPath, getProductMarketPath } from "@/config/paths";
import { getAllMarketSlugs } from "@/constants/product-catalog";
import {
  getSingleSiteSitemapPageConfig,
  SINGLE_SITE_PUBLIC_STATIC_PAGES,
} from "@/config/single-site-seo";
import { getMdxPageLastModified } from "@/lib/content/page-dates";
import { getStaticPageLastModified } from "@/lib/sitemap-utils";
import sitemap, { generateSitemap } from "../sitemap";

// Mock dependencies before imports
vi.mock("@/config/paths", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/paths")>();

  return {
    ...actual,
    SITE_CONFIG: {
      ...actual.SITE_CONFIG,
      baseUrl: "https://example.com",
    },
  };
});

vi.mock("@/i18n/routing", () => ({
  routing: {
    locales: ["en"],
    defaultLocale: "en",
  },
}));

vi.mock("@/lib/sitemap-utils", async () => {
  const { getCanonicalPath } = await import("@/config/paths/utils");
  const productsPath = getCanonicalPath("products");
  const staticLastmodPaths = new Set(["", productsPath, "/request-quote"]);

  return {
    getStaticPageLastModified: vi.fn((page: string) => {
      if (page === "") {
        return new Date("2024-12-01T00:00:00Z");
      }
      const marketSlug = page.startsWith(`${productsPath}/`)
        ? page.slice(productsPath.length + 1)
        : "";
      if (
        staticLastmodPaths.has(page) ||
        (marketSlug.length > 0 && !marketSlug.includes("/"))
      ) {
        return new Date("2024-11-01T00:00:00Z");
      }
      throw new Error(`Unexpected static lastmod fallback: ${page}`);
    }),
  };
});

vi.mock("@/lib/content/page-dates", async () => {
  const { getMdxPageSlugByStaticPath } = await import("@/config/pages.config");

  return {
    isMdxDrivenPage: vi.fn(
      (path: string) => path in getMdxPageSlugByStaticPath(),
    ),
    getMdxPageLastModified: vi.fn(async () => new Date("2026-04-20T00:00:00Z")),
  };
});

describe("sitemap.ts", () => {
  const BASE_URL = "https://example.com";
  const defaultLocale = "en";

  function sitemapPathForCanonical(path: string): string {
    return path === "/" ? "" : path;
  }

  function localizedUrl(_locale: string, path: string): string {
    return new URL(path === "" ? "/" : path, BASE_URL).toString();
  }

  function findEntry(
    entries: Awaited<ReturnType<typeof sitemap>>,
    locale: string,
    path: string,
  ) {
    return entries.find((entry) => entry.url === localizedUrl(locale, path));
  }

  describe("sitemap()", () => {
    it("should return sitemap array", async () => {
      const result = await sitemap();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should include current catalog static pages for the English site", async () => {
      const result = await sitemap();

      for (const pagePath of SINGLE_SITE_PUBLIC_STATIC_PAGES) {
        expect(findEntry(result, defaultLocale, pagePath)).toBeDefined();
      }
    });

    it("should exclude retired demo static pages by default", async () => {
      const result = await sitemap();
      const urls = result.map((entry) => entry.url);

      for (const pagePath of SINGLE_SITE_PUBLIC_STATIC_PAGES) {
        expect(urls).toContain(localizedUrl(defaultLocale, pagePath));
      }
      expect(findEntry(result, "en", "/products")).toBeDefined();

      // The whole URL set, derived from config. The old form listed five retired
      // paths and asserted each stays absent — it could only catch routes someone
      // remembered to name, and said nothing about a new page leaking in.
      expect([...new Set(urls)].sort()).toEqual(
        [
          ...SINGLE_SITE_PUBLIC_STATIC_PAGES.map((pagePath) =>
            localizedUrl(defaultLocale, pagePath),
          ),
          ...getAllMarketSlugs().map((marketSlug) =>
            localizedUrl(defaultLocale, getProductMarketPath(marketSlug)),
          ),
        ].sort(),
      );
    });

    it("pins representative default sitemap contract entries with fixed values", async () => {
      const result = await sitemap();

      expect(findEntry(result, "en", "")).toMatchObject({
        url: "https://example.com/",
        priority: 1.0,
        changeFrequency: "daily",
      });
      expect(findEntry(result, "en", "/about")).toMatchObject({
        url: "https://example.com/about",
        priority: 0.8,
        changeFrequency: "monthly",
        lastModified: new Date("2026-04-20T00:00:00Z"),
      });
      expect(findEntry(result, "en", "/contact")).toMatchObject({
        url: "https://example.com/contact",
        priority: 0.8,
        changeFrequency: "monthly",
        lastModified: new Date("2026-04-20T00:00:00Z"),
      });
      expect(findEntry(result, "en", "/terms")).toMatchObject({
        url: "https://example.com/terms",
        priority: 0.7,
        changeFrequency: "monthly",
      });
      expect(findEntry(result, "en", "/capabilities")).toBeUndefined();
      expect(findEntry(result, "en", "/how-it-works")).toBeUndefined();
      expect(
        findEntry(result, "en", "/products/abs-flood-barriers"),
      ).toBeDefined();
    });

    it("should include current product catalog market pages by default", async () => {
      const result = await sitemap();
      const urls = result.map((entry) => entry.url);

      for (const marketSlug of getAllMarketSlugs()) {
        expect(urls).toContain(
          localizedUrl(defaultLocale, getProductMarketPath(marketSlug)),
        );
      }
    });

    it("should have lastModified for entries", async () => {
      const result = await sitemap();

      for (const entry of result) {
        expect(entry.lastModified).toBeDefined();
        expect(entry.lastModified).toBeInstanceOf(Date);
      }
    });

    it("should have changeFrequency for entries", async () => {
      const result = await sitemap();
      const validFrequencies = [
        "always",
        "hourly",
        "daily",
        "weekly",
        "monthly",
        "yearly",
        "never",
      ];

      for (const entry of result) {
        expect(validFrequencies).toContain(entry.changeFrequency);
      }
    });

    it("should have priority for entries", async () => {
      const result = await sitemap();

      for (const entry of result) {
        expect(entry.priority).toBeDefined();
        expect(entry.priority).toBeGreaterThanOrEqual(0);
        expect(entry.priority).toBeLessThanOrEqual(1);
      }
    });

    it("should have alternates with languages", async () => {
      const result = await sitemap();

      for (const entry of result) {
        expect(entry.alternates).toBeDefined();
        expect(entry.alternates?.languages).toBeDefined();
      }
    });

    it("should include x-default in alternates", async () => {
      const result = await sitemap();
      const enHome = findEntry(result, defaultLocale, "");

      expect(enHome?.alternates?.languages?.["x-default"]).toBeDefined();
    });

    it("should set home page priority to 1.0", async () => {
      const result = await sitemap();
      const homePath = sitemapPathForCanonical(getCanonicalPath("home"));
      const home = findEntry(result, defaultLocale, homePath);
      const homeConfig = getSingleSiteSitemapPageConfig(homePath);

      expect(home?.priority).toBe(homeConfig.priority);
    });

    it("should expose products listing priority in the default sitemap", async () => {
      const result = await sitemap();
      const productsPath = getCanonicalPath("products");
      const products = findEntry(result, defaultLocale, productsPath);
      const productsConfig = getSingleSiteSitemapPageConfig(productsPath);

      expect(products).toMatchObject({
        priority: productsConfig.priority,
        changeFrequency: productsConfig.changeFrequency,
      });
    });

    it("should set home page changeFrequency from sitemap config", async () => {
      const result = await sitemap();
      const homePath = sitemapPathForCanonical(getCanonicalPath("home"));
      const home = findEntry(result, defaultLocale, homePath);
      const homeConfig = getSingleSiteSitemapPageConfig(homePath);

      expect(home?.changeFrequency).toBe(homeConfig.changeFrequency);
    });

    it("should set about page changeFrequency from sitemap config", async () => {
      const result = await sitemap();
      const aboutPath = getCanonicalPath("about");
      const about = findEntry(result, defaultLocale, aboutPath);
      const aboutConfig = getSingleSiteSitemapPageConfig(aboutPath);

      expect(about?.changeFrequency).toBe(aboutConfig.changeFrequency);
    });

    it("should use MDX updatedAt for MDX-driven page lastmod", async () => {
      const result = await sitemap();
      const aboutPath = getCanonicalPath("about");
      const about = findEntry(result, defaultLocale, aboutPath);

      expect(getMdxPageLastModified).toHaveBeenCalledWith(aboutPath);
      expect(about?.lastModified).toEqual(new Date("2026-04-20T00:00:00Z"));
    });

    it("should use MDX dates for default active MDX pages and sidecar dates for static pages", async () => {
      const result = await sitemap();
      const aboutPath = getCanonicalPath("about");
      const contactPath = getCanonicalPath("contact");
      const productsPath = getCanonicalPath("products");
      const requestQuotePath = getCanonicalPath("requestQuote");
      const [marketSlug] = getAllMarketSlugs();
      const marketPath = getProductMarketPath(marketSlug ?? "");
      const about = findEntry(result, defaultLocale, aboutPath);
      const contact = findEntry(result, defaultLocale, contactPath);
      const products = findEntry(result, defaultLocale, productsPath);
      const requestQuote = findEntry(result, defaultLocale, requestQuotePath);
      const market = findEntry(result, defaultLocale, marketPath);

      expect(marketSlug).toBeDefined();
      expect(getMdxPageLastModified).toHaveBeenCalledWith(aboutPath);
      expect(getMdxPageLastModified).toHaveBeenCalledWith(contactPath);
      expect(getStaticPageLastModified).toHaveBeenCalledWith(
        productsPath,
        expect.any(Map),
      );
      expect(getStaticPageLastModified).toHaveBeenCalledWith(
        requestQuotePath,
        expect.any(Map),
      );
      expect(getStaticPageLastModified).toHaveBeenCalledWith(
        marketPath,
        expect.any(Map),
      );
      expect(about?.lastModified).toEqual(new Date("2026-04-20T00:00:00Z"));
      expect(contact?.lastModified).toEqual(new Date("2026-04-20T00:00:00Z"));
      expect(products?.lastModified).toEqual(new Date("2024-11-01T00:00:00Z"));
      expect(requestQuote?.lastModified).toEqual(
        new Date("2024-11-01T00:00:00Z"),
      );
      expect(market?.lastModified).toEqual(new Date("2024-11-01T00:00:00Z"));
    });

    it("should keep terms page SEO defaults explicit", async () => {
      const result = await sitemap();
      const termsPath = getCanonicalPath("terms");
      const terms = findEntry(result, defaultLocale, termsPath);
      const termsConfig = getSingleSiteSitemapPageConfig(termsPath);

      expect(terms?.priority).toBe(termsConfig.priority);
      expect(terms?.changeFrequency).toBe(termsConfig.changeFrequency);
    });

    it("should not have duplicate entries", async () => {
      const result = await sitemap();
      const urls = result.map((entry) => entry.url);
      const uniqueUrls = new Set(urls);

      expect(uniqueUrls.size).toBe(urls.length);
    });

    it("generates catalog sitemap entries for every configured market", async () => {
      const result = await generateSitemap();
      const urls = result.map((entry) => entry.url);

      expect(urls).toContain(localizedUrl(defaultLocale, "/products"));
      expect(urls).toContain(localizedUrl(defaultLocale, "/about"));

      for (const marketSlug of getAllMarketSlugs()) {
        expect(urls).toContain(
          localizedUrl(defaultLocale, getProductMarketPath(marketSlug)),
        );
      }
    });
  });
});
