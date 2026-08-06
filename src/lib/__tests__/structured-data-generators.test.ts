import { describe, expect, it } from "vitest";
import { SITE_CONFIG } from "@/config/paths";
import { SINGLE_SITE_FACTS } from "@/config/single-site";
import {
  buildWebPageSchema,
  generateArticleData,
  generateOrganizationData,
  generateProductData,
  generateWebSiteData,
  organizationStructuredDataId,
  websiteStructuredDataId,
} from "@/lib/structured-data-generators";
import type { Locale } from "@/i18n/routing";

const mockTranslator = ((key: string) => {
  const values: Record<string, string> = {
    "organization.name": SITE_CONFIG.name,
    "organization.description": SITE_CONFIG.description,
    "website.name": SITE_CONFIG.name,
    "website.description": SITE_CONFIG.seo.defaultDescription,
    "article.defaultAuthor": SITE_CONFIG.name,
    "organization.social.twitter": "",
    "organization.social.linkedin": "",
  };

  return values[key] ?? key;
}) as Awaited<
  ReturnType<
    typeof import("next-intl/server").getTranslations<"structured-data">
  >
>;

describe("structured-data generators", () => {
  describe("Given legal and conversion pages need valid WebPage nodes", () => {
    it("When building a privacy-style WebPage, Then the graph uses stable site identities", () => {
      const pageUrl = new URL("/privacy", SITE_CONFIG.baseUrl).toString();
      const schema = buildWebPageSchema({
        locale: "en",
        name: "Privacy Policy",
        description: "How we handle data.",
        url: pageUrl,
        datePublished: "2024-01-01",
      });

      expect(schema).toMatchObject({
        "@type": "WebPage",
        "@id": pageUrl,
        url: pageUrl,
        datePublished: "2024-01-01",
        isPartOf: { "@id": "https://example.com#website" },
        about: { "@id": "https://example.com#organization" },
      });
      expect(schema).not.toHaveProperty("additionalType");
    });

    it("When building a terms-style WebPage, Then optional dates obey exact optional fields", () => {
      const pageUrl = new URL("/terms", SITE_CONFIG.baseUrl).toString();
      const schema = buildWebPageSchema({
        locale: "en",
        name: "Terms of Service",
        url: pageUrl,
        dateModified: "2024-02-01",
      });

      expect(schema).toMatchObject({
        "@type": "WebPage",
        "@id": pageUrl,
        url: pageUrl,
        dateModified: "2024-02-01",
        isPartOf: { "@id": "https://example.com#website" },
        about: { "@id": "https://example.com#organization" },
      });
      expect(schema).not.toHaveProperty("datePublished");
      expect(schema).not.toHaveProperty("additionalType");
    });

    it("When building a request-quote WebPage, Then the node references stable site identities", () => {
      const pageUrl = new URL("/request-quote", SITE_CONFIG.baseUrl).toString();
      const schema = buildWebPageSchema({
        locale: "en",
        name: "Request a Quote",
        description: "Get pricing within 12 hours.",
        url: pageUrl,
      });

      expect(schema).toMatchObject({
        "@type": "WebPage",
        "@id": pageUrl,
        url: pageUrl,
        isPartOf: { "@id": "https://example.com#website" },
        about: { "@id": "https://example.com#organization" },
      });
    });
  });

  describe("Given Article pages publish under the company brand", () => {
    it("When generating Article schema, Then author is Organization not Person", () => {
      const schema = generateArticleData(mockTranslator, "en" as Locale, {
        title: "Materials Guide",
        description: "Barrier material overview.",
        publishedTime: "2026-01-01",
        url: `${SITE_CONFIG.baseUrl}/materials-guide`,
      });

      expect(schema.author).toMatchObject({
        "@type": "Organization",
        "@id": organizationStructuredDataId(SITE_CONFIG.baseUrl),
      });
      expect(schema.author).not.toMatchObject({ "@type": "Person" });
    });
  });

  describe("Given site identity nodes are shared across the graph", () => {
    it("When generating Organization data, Then real contact facts and stable @id are present", () => {
      const schema = generateOrganizationData(mockTranslator, {});

      expect(schema).toMatchObject({
        "@type": "Organization",
        "@id": organizationStructuredDataId(SITE_CONFIG.baseUrl),
        email: SITE_CONFIG.contact.email,
        foundingDate: String(SINGLE_SITE_FACTS.company.established),
      });
      expect(schema.address).toMatchObject({
        "@type": "PostalAddress",
        streetAddress: SINGLE_SITE_FACTS.company.location.address,
        addressLocality: SINGLE_SITE_FACTS.company.location.city,
        addressCountry: SINGLE_SITE_FACTS.company.location.country,
      });
    });

    it("When generating WebSite data, Then stable @id and publisher reference are present", () => {
      const schema = generateWebSiteData(mockTranslator, {});

      expect(schema).toMatchObject({
        "@type": "WebSite",
        "@id": websiteStructuredDataId(SITE_CONFIG.baseUrl),
        publisher: {
          "@id": organizationStructuredDataId(SITE_CONFIG.baseUrl),
        },
      });
    });
  });

  describe("Given a product detail page represents one catalog item", () => {
    it("When generating product schema, Then only one Product node shape is emitted", () => {
      const schema = generateProductData({
        name: "ABS Interlocking Boxwall Flood Barriers",
        description: "A freestanding flood barrier that needs no bolts.",
        url: `${SITE_CONFIG.baseUrl}/products/abs-flood-barriers`,
        brand: SITE_CONFIG.name,
      });

      expect(schema["@type"]).toBe("Product");
      expect(schema).not.toHaveProperty("hasVariant");
      expect(schema["@type"]).not.toBe("ProductGroup");
    });
  });
});
