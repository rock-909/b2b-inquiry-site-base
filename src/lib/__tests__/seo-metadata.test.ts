import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCanonicalForPath,
  createStaticPageMetadataConfig,
  generateMetadataForPath,
} from "../seo-metadata";

vi.mock("@/config/paths", () => ({
  SITE_CONFIG: {
    baseUrl: "https://example.com",
    name: "Test Site",
    seo: {
      titleTemplate: "%s | Test Site",
      defaultTitle: "Default Title",
      defaultDescription: "Default Description",
    },
  },
}));

vi.mock("@/config/single-site", () => ({
  SINGLE_SITE_FACTS: {
    company: {
      established: 2021,
    },
    brandAssets: {
      ogImage: "/images/facts-og.png",
    },
  },
}));

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
      expect(buildCanonicalForPath("/about")).toBe("https://example.com/about");
      expect(buildCanonicalForPath("/")).toBe("https://example.com/");
    });

    it("joins paths safely when SITE_CONFIG.baseUrl has a trailing slash", async () => {
      vi.resetModules();
      vi.doMock("@/config/paths", () => ({
        SITE_CONFIG: {
          baseUrl: "https://example.com/",
          name: "Test Site",
          seo: {
            titleTemplate: "%s | Test Site",
            defaultTitle: "Default Title",
            defaultDescription: "Default Description",
          },
        },
      }));

      const { buildCanonicalForPath: buildCanonical } =
        await import("../seo-metadata");

      expect(buildCanonical("/products/abs-flood-barriers")).toBe(
        "https://example.com/products/abs-flood-barriers",
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
      expect(metadata.openGraph?.locale).toBe("en");
      expect(metadata.verification).toEqual({
        google: "google-verification-code",
        yandex: "yandex-verification-code",
      });
    });

    it("interpolates established-year placeholders in custom titles", () => {
      const metadata = generateMetadataForPath({
        locale: "en",
        pageType: "about",
        path: "/about",
        config: {
          title: "Established in {established}",
        },
      });

      expect(metadata.title).toBe("Established in 2021");
    });

    it("renders canonical, hreflang and openGraph.url from the actual route path", () => {
      const metadata = generateMetadataForPath({
        locale: "en",
        pageType: "about",
        path: "/about",
        config: {
          title: "Custom About",
          description: "Custom About Description",
        },
      });

      expect(metadata.alternates?.canonical).toBe("https://example.com/about");
      expect(metadata.alternates?.languages).toEqual({
        en: "https://example.com/about",
        "x-default": "https://example.com/about",
      });
      expect(metadata.openGraph?.url).toBe("https://example.com/about");
    });

    it("noindexes active catalog pages outside production", () => {
      process.env.APP_ENV = "preview";

      const metadata = generateMetadataForPath({
        locale: "en",
        pageType: "products",
        path: "/products",
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

    it("keeps active catalog pages indexable in production", () => {
      process.env.APP_ENV = "production";

      const metadata = generateMetadataForPath({
        locale: "en",
        pageType: "products",
        path: "/products",
      });

      expect(metadata.robots).toMatchObject({
        index: true,
        follow: true,
      });
    });

    it("indexes product market pages in the catalog-only public SEO surface", () => {
      process.env.APP_ENV = "production";
      const metadata = generateMetadataForPath({
        locale: "en",
        pageType: "products",
        path: "/products/abs-flood-barriers",
      });

      expect(metadata.robots).toMatchObject({
        index: true,
        follow: true,
      });
    });

    it("renders default OG and Twitter images from page defaults", () => {
      const metadata = generateMetadataForPath({
        locale: "en",
        pageType: "about",
        path: "/about",
        config: {
          title: "About Tucsenberg",
          description: "About page description",
        },
      });

      expect(metadata.openGraph?.images).toEqual([
        { url: "/images/facts-og.png" },
      ]);
      expect(metadata.twitter?.images).toEqual(["/images/facts-og.png"]);
    });

    it("maps product openGraph type to website", () => {
      const metadata = generateMetadataForPath({
        locale: "en",
        pageType: "products",
        path: "/products",
        config: {
          type: "product",
        },
      });

      expect(metadata.openGraph).toMatchObject({ type: "website" });
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

    it("preserves empty static page descriptions when a route opts in", () => {
      expect(
        createStaticPageMetadataConfig(
          {
            title: "Page title",
            description: "Page description",
            seo: {
              description: "",
            },
          },
          { includeEmptyDescription: true },
        ),
      ).toEqual({
        title: "Page title",
        description: "",
      });
    });
  });
});
