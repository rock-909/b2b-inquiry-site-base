import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import {
  buildCanonicalForPath,
  createStaticPageMetadataConfig,
  generateMetadataForPath,
} from "../seo-metadata";

vi.mock("@/config/single-site", () => ({
  SINGLE_SITE_CONFIG: {
    baseUrl: "https://example.com",
    name: "Test Site",
    seo: {
      titleTemplate: "%s | Test Site",
      defaultTitle: "Default Title",
      defaultDescription: "Default Description",
    },
  },
  SINGLE_SITE_FACTS: {
    company: {
      name: "Test Company",
      established: 2021,
    },
    brandAssets: {
      ogImage: "/images/facts-og.png",
    },
  },
}));

const { defaultLocale, locales } = LOCALES_CONFIG;
const localeUrl = (locale: string, path: string) =>
  `https://example.com${locale === defaultLocale ? "" : `/${locale}`}${path}`;
const otherLocale = locales.find((locale) => locale !== defaultLocale);

describe("SEO Metadata", () => {
  beforeEach(() => {
    process.env.GOOGLE_SITE_VERIFICATION = "google-verification-code";
    process.env.YANDEX_VERIFICATION = "yandex-verification-code";
  });

  afterEach(() => {
    delete process.env.GOOGLE_SITE_VERIFICATION;
    delete process.env.YANDEX_VERIFICATION;
    delete process.env.APP_ENV;
  });

  describe("buildCanonicalForPath", () => {
    it("builds canonical URLs from the route path without locale prefixes", () => {
      expect(buildCanonicalForPath("/privacy")).toBe(
        "https://example.com/privacy",
      );
      expect(buildCanonicalForPath("/")).toBe("https://example.com/");
    });

    it("joins paths safely when SITE_CONFIG.baseUrl has a trailing slash", async () => {
      vi.resetModules();
      vi.doMock("@/config/single-site", () => ({
        SINGLE_SITE_CONFIG: {
          baseUrl: "https://example.com/",
          name: "Test Site",
          seo: {
            titleTemplate: "%s | Test Site",
            defaultTitle: "Default Title",
            defaultDescription: "Default Description",
          },
        },
        SINGLE_SITE_FACTS: {
          company: { established: 2021 },
          brandAssets: { ogImage: "/images/facts-og.png" },
        },
      }));

      const { buildCanonicalForPath: buildCanonical } =
        await import("../seo-metadata");

      expect(buildCanonical("/products/sample-offering")).toBe(
        "https://example.com/products/sample-offering",
      );
      expect(buildCanonical("/")).toBe("https://example.com/");
    });
  });

  describe("generateMetadataForPath", () => {
    it("uses SITE_CONFIG fallbacks when page config is absent", () => {
      const metadata = generateMetadataForPath({
        locale: "en",
        pageType: "home",
        path: "/",
      });

      expect(metadata.title).toBe("Default Title");
      expect(metadata.description).toBe("Default Description");
      expect(metadata.openGraph?.siteName).toBe("Test Site");
      expect(metadata.openGraph?.locale).toBe("en_US");
      expect(metadata.verification).toEqual({
        google: "google-verification-code",
        yandex: "yandex-verification-code",
      });
    });

    it("renders canonical, hreflang and openGraph.url from the actual route path", () => {
      const metadata = generateMetadataForPath({
        locale: "en",
        pageType: "privacy",
        path: "/privacy",
        config: {
          title: "Custom About",
          description: "Custom About Description",
        },
      });

      expect(metadata.alternates?.canonical).toBe(
        "https://example.com/privacy",
      );
      expect(metadata.alternates?.languages).toEqual({
        ...Object.fromEntries(
          locales.map((locale) => [locale, localeUrl(locale, "/privacy")]),
        ),
        "x-default": "https://example.com/privacy",
      });
      expect(metadata.openGraph?.url).toBe("https://example.com/privacy");
    });

    // 单语言站点没有非默认语言，此用例自然跳过。
    it.skipIf(otherLocale === undefined)(
      "builds locale-specific canonical and alternate URLs",
      () => {
        const locale = otherLocale!;
        const metadata = generateMetadataForPath({
          locale,
          pageType: "privacy",
          path: "/privacy",
        });

        expect(metadata.alternates?.canonical).toBe(
          `https://example.com/${locale}/privacy`,
        );
        expect(metadata.openGraph?.url).toBe(
          `https://example.com/${locale}/privacy`,
        );
        expect(metadata.openGraph?.locale).toContain(`${locale}_`);
      },
    );

    it("noindexes active public pages outside production", () => {
      process.env.APP_ENV = "preview";

      const metadata = generateMetadataForPath({
        locale: "en",
        pageType: "privacy",
        path: "/privacy",
      });

      expect(metadata.robots).toMatchObject({
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
        },
      });
    });

    it("keeps active public pages indexable in production", () => {
      process.env.APP_ENV = "production";

      const metadata = generateMetadataForPath({
        locale: "en",
        pageType: "contact",
        path: "/contact",
      });

      expect(metadata.robots).toMatchObject({
        index: true,
        follow: true,
      });
    });

    it("keeps incomplete legal pages noindex even in production, with localized canonical URLs", () => {
      process.env.APP_ENV = "production";
      for (const pageType of ["privacy", "terms"] as const) {
        for (const locale of locales) {
          const metadata = generateMetadataForPath({
            locale,
            pageType,
            path: `/${pageType}`,
          });
          expect(metadata.robots).toMatchObject({
            index: false,
            follow: false,
            googleBot: { index: false },
          });
          expect(metadata.alternates?.canonical).toBe(
            localeUrl(locale, `/${pageType}`),
          );
          expect(metadata.alternates?.languages).toHaveProperty("x-default");
        }
      }
    });

    it("noindexes a core page type on a non-canonical path", () => {
      process.env.APP_ENV = "production";
      const metadata = generateMetadataForPath({
        locale: "en",
        pageType: "privacy",
        path: "/products",
      });

      expect(metadata.robots).toMatchObject({
        index: false,
        follow: false,
      });
    });

    it("renders default OG and Twitter images from page defaults", () => {
      const metadata = generateMetadataForPath({
        locale: "en",
        pageType: "privacy",
        path: "/privacy",
        config: {
          title: "About Reference Industries",
          description: "About page description",
        },
      });

      expect(metadata.openGraph?.images).toEqual([
        { url: "/images/facts-og.png" },
      ]);
      expect(metadata.twitter?.images).toEqual(["/images/facts-og.png"]);
    });
  });

  describe("createStaticPageMetadataConfig", () => {
    it("builds title and description from static page SEO overrides by default", () => {
      expect(
        createStaticPageMetadataConfig({
          title: "Page title",
          description: "Page description",
          seo: {
            title: "SEO title",
            description: "SEO description",
            ogImage: "/seo.jpg",
          },
        }),
      ).toEqual({
        title: "SEO title",
        description: "SEO description",
      });
    });

    it("includes image only when a route opts in", () => {
      expect(
        createStaticPageMetadataConfig(
          {
            title: "Page title",
            description: "Page description",
            seo: {
              title: "SEO title",
              description: "SEO description",
              ogImage: "/seo.jpg",
            },
          },
          { includeImage: true },
        ),
      ).toEqual({
        title: "SEO title",
        description: "SEO description",
        image: "/seo.jpg",
      });
    });

    it("falls back to the site default description when seo.description is empty", () => {
      const metadata = generateMetadataForPath({
        locale: "en",
        pageType: "privacy",
        path: "/privacy",
        config: createStaticPageMetadataConfig({
          title: "Page title",
          description: "Page description",
          seo: { description: "" },
        }),
      });

      expect(metadata.description).toBe("Default Description");
    });
  });
});
