import { describe, expect, it, vi } from "vitest";
import { buildShellPageSchema } from "@/components/content/legal-page-shell";

vi.mock("@/config/single-site", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/single-site")>();
  return {
    ...actual,
    SINGLE_SITE_CONFIG: {
      ...actual.SINGLE_SITE_CONFIG,
      baseUrl: "https://www.example.com",
    },
  };
});

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
        "organization.name": "Reference Industries",
        "article.defaultAuthor": "Reference Industries",
      },
    };

    return (key: string) => values[namespace]?.[key] ?? key;
  }),
}));

const REQUIRED_LEGAL_METADATA = {
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
      pageUrl,
    });

    expect(schema).toMatchObject({
      "@type": "WebPage",
      "@id": pageUrl,
      url: pageUrl,
    });
    expect(schema).not.toHaveProperty("additionalType");
  });

});
