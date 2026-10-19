import { generateJSONLD } from "@/lib/structured-data";
import { afterEach, describe, expect, it } from "vitest";
import { SINGLE_SITE_CONFIG as SITE_CONFIG } from "@/config/single-site";
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
      });

      expect(schema).toMatchObject({
        "@type": "WebPage",
        "@id": pageUrl,
        url: pageUrl,
        isPartOf: { "@id": "https://example.com#website" },
      });
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

  const originalConfig = structuredClone(SITE_CONFIG);
  afterEach(() => {
    delete SITE_CONFIG.company;
    Object.assign(SITE_CONFIG, structuredClone(originalConfig));
  });

  it("omits unconfigured organizations and their references", () => {
    expect(generateOrganizationData()).toBeUndefined();
    expect(generateWebSiteData(mockTranslator)).not.toHaveProperty("publisher");
    expect(
      buildWebPageSchema({ locale: "en", name: "Contact", url: "/contact" }),
    ).not.toHaveProperty("about");
  });

  it("publishes configured facts and omits empty ones", () => {
    SITE_CONFIG.company = {
      name: "Acme Manufacturing",
      established: 2001,
      location: { city: "London", address: "" },
    };
    SITE_CONFIG.contact = { email: "info@acme.co.uk", phone: "" };
    SITE_CONFIG.social = {
      linkedin: "https://linkedin.com/company/acme",
      twitter: "",
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

  it("does not manufacture optional company facts or an email", () => {
    SITE_CONFIG.company = { name: "Acme Manufacturing" };
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
    SITE_CONFIG.company = { name: "" };
    expect(generateOrganizationData()).toBeUndefined();
  });

  // 运行时不再按文本猜占位：真实地址里含旧触发词也照常输出，占位只由上线门禁拦截。
  it("publishes real facts that contain former placeholder trigger words", () => {
    SITE_CONFIG.company = {
      name: "Placeholder Analytics Ltd",
      location: { address: "1 Harbour Road", city: "Example City" },
    };
    expect(generateOrganizationData()).toMatchObject({
      name: "Placeholder Analytics Ltd",
      address: {
        "@type": "PostalAddress",
        streetAddress: "1 Harbour Road",
        addressLocality: "Example City",
      },
    });
  });

  it("publishes a ready logo and omits a pending one", () => {
    SITE_CONFIG.company = { name: "Acme Manufacturing" };
    SITE_CONFIG.brandAssets.logo = {
      status: "ready",
      width: 240,
      height: 72,
      horizontal: "/images/logo.svg",
    };
    expect(generateOrganizationData()?.logo).toBe(
      new URL("/images/logo.svg", SITE_CONFIG.baseUrl).href,
    );
    SITE_CONFIG.brandAssets.logo.status = "pending";
    expect(generateOrganizationData()).not.toHaveProperty("logo");
  });
});
