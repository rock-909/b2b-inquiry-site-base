import { generateJSONLD } from "@/lib/structured-data";
import { afterEach, describe, expect, it } from "vitest";
import {
  SINGLE_SITE_CONFIG as SITE_CONFIG,
  SINGLE_SITE_FACTS,
} from "@/config/single-site";
import {
  buildWebPageSchema,
  generateOrganizationData,
  generateWebSiteData,
  organizationStructuredDataId,
} from "@/lib/structured-data-generators";

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
      });
      expect(schema).not.toHaveProperty("datePublished");
      expect(schema).not.toHaveProperty("additionalType");
    });

    it("When building a WebPage, Then the node references stable site identities", () => {
      const pageUrl = new URL("/contact", SITE_CONFIG.baseUrl).toString();
      const schema = buildWebPageSchema({
        locale: "en",
        name: "Request a Quote",
        description: "Request pricing for the confirmed scope.",
        url: pageUrl,
      });

      expect(schema).toMatchObject({
        "@type": "WebPage",
        "@id": pageUrl,
        url: pageUrl,
        isPartOf: { "@id": "https://example.com#website" },
      });
    });
  });

  const originalFacts = structuredClone(SINGLE_SITE_FACTS);
  afterEach(() => {
    delete SINGLE_SITE_FACTS.company;
    Object.assign(SINGLE_SITE_FACTS, structuredClone(originalFacts));
  });

  it("omits unconfigured organizations and their references", () => {
    expect(generateOrganizationData()).toBeUndefined();
    expect(generateWebSiteData(mockTranslator)).not.toHaveProperty("publisher");
    expect(
      buildWebPageSchema({ locale: "en", name: "Contact", url: "/contact" }),
    ).not.toHaveProperty("about");
  });

  it("publishes only configured valid facts from the shared source", () => {
    SINGLE_SITE_FACTS.company = {
      name: "Acme Manufacturing",
      established: 2001,
      location: { city: "London", address: "Replace before launch" },
    };
    SINGLE_SITE_FACTS.contact = {
      email: "info@acme.co.uk",
      phone: "invalid phone",
    };
    SINGLE_SITE_FACTS.social = {
      linkedin: "https://linkedin.com/company/acme",
      twitter: "javascript:alert(1)",
    };
    const schema = generateOrganizationData();
    expect(schema).toMatchObject({
      "@type": "Organization",
      name: "Acme Manufacturing",
      email: "info@acme.co.uk",
      foundingDate: "2001",
      address: { addressLocality: "London" },
      sameAs: ["https://linkedin.com/company/acme"],
    });
    expect(JSON.parse(generateJSONLD(schema)).address).not.toHaveProperty(
      "streetAddress",
    );
    expect(schema).not.toHaveProperty("telephone");
    expect(schema).not.toHaveProperty("logo");
    expect(generateWebSiteData(mockTranslator).publisher).toEqual({
      "@id": organizationStructuredDataId(),
    });
  });

  it("does not manufacture optional company facts or publish a placeholder email", () => {
    SINGLE_SITE_FACTS.company = { name: "Acme Manufacturing" };
    const schema = generateOrganizationData();
    for (const key of [
      "foundingDate",
      "address",
      "logo",
      "email",
      "telephone",
      "sameAs",
    ])
      expect(schema).not.toHaveProperty(key);
    SINGLE_SITE_FACTS.company = { name: "Replace before launch" };
    expect(generateOrganizationData()).toBeUndefined();
  });
  it("publishes only same-origin logo URLs for a configured company", () => {
    SINGLE_SITE_FACTS.company = { name: "Acme Manufacturing" };
    SINGLE_SITE_FACTS.brandAssets.logo = {
      status: "ready",
      width: 240,
      height: 72,
      horizontal: "/images/logo.svg",
    };
    expect(generateOrganizationData()?.logo).toBe(
      new URL("/images/logo.svg", SITE_CONFIG.baseUrl).href,
    );
    SINGLE_SITE_FACTS.brandAssets.logo.horizontal = String.raw`/\cdn.invalid/logo.svg`;
    expect(generateOrganizationData()).not.toHaveProperty("logo");
  });
});
