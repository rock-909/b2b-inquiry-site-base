import { describe, expect, it, vi } from "vitest";
import { buildShellPageSchema } from "@/components/content/legal-page-shell";

vi.mock("@/config/paths", () => ({
  SITE_CONFIG: {
    baseUrl: "https://www.example.com",
  },
}));

vi.mock("@/config/paths/site-config", () => ({
  SITE_CONFIG: {
    baseUrl: "https://www.example.com",
  },
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async ({ namespace }: { namespace: string }) => {
    const values: Record<string, Record<string, string>> = {
      legal: {
        effectiveDate: "Effective",
        lastUpdated: "Updated",
        tableOfContents: "Contents",
      },
      navigation: {
        home: "Home",
      },
      "structured-data": {
        "organization.name": "Tucsenberg",
        "article.defaultAuthor": "Tucsenberg",
      },
    };

    return (key: string) => values[namespace]?.[key] ?? key;
  }),
}));

const REQUIRED_LEGAL_METADATA = {
  layout: "legal",
  showToc: true,
  lastReviewed: "2024-01-01",
} as const;

describe("LegalPageShell structured data", () => {
  it("Given privacy legal metadata, When the shell renders, Then WebPage JSON-LD uses the page URL graph", async () => {
    const pageUrl = "https://www.example.com/privacy";
    const schema = await buildShellPageSchema({
      metadata: {
        ...REQUIRED_LEGAL_METADATA,
        title: "Privacy Policy",
        slug: "privacy",
        publishedAt: "2024-01-01",
        seo: {
          title: "Privacy Policy",
          description: "Privacy description",
        },
      },
      locale: "en",
      schemaType: "WebPage",
      pageUrl,
    });

    expect(schema).toMatchObject({
      "@type": "WebPage",
      "@id": pageUrl,
      url: pageUrl,
      isPartOf: { "@id": "https://www.example.com#website" },
      about: {
        "@id": "https://www.example.com#organization",
      },
    });
    expect(schema).not.toHaveProperty("additionalType");
  });

  it("Given terms legal metadata, When the shell renders, Then WebPage JSON-LD has no additionalType", async () => {
    const pageUrl = "https://www.example.com/terms";
    const schema = await buildShellPageSchema({
      metadata: {
        ...REQUIRED_LEGAL_METADATA,
        title: "Terms of Service",
        slug: "terms",
        publishedAt: "2024-01-01",
        seo: {
          title: "Terms of Service",
          description: "Terms description",
        },
      },
      locale: "en",
      schemaType: "WebPage",
      pageUrl,
    });

    expect(schema).toMatchObject({
      "@type": "WebPage",
      "@id": pageUrl,
      url: pageUrl,
    });
    expect(schema).not.toHaveProperty("additionalType");
  });

  it("Given article metadata, When the shell renders, Then author is Organization", async () => {
    const schema = await buildShellPageSchema({
      metadata: {
        ...REQUIRED_LEGAL_METADATA,
        title: "Materials Guide",
        slug: "materials-guide",
        publishedAt: "2026-01-01",
        author: "Tucsenberg",
        seo: {
          title: "Materials Guide",
          description: "Guide description",
        },
      },
      locale: "en",
      schemaType: "Article",
      pageUrl: "https://www.example.com/materials-guide",
    });

    expect(schema.author).toMatchObject({
      "@type": "Organization",
    });
  });
});
