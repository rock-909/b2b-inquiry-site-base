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
    });
    // 页面不显示日期，JSON-LD 也不能声明。
    expect(schema).not.toHaveProperty("datePublished");
    expect(schema).not.toHaveProperty("dateModified");
    expect(schema).not.toHaveProperty("additionalType");
    expect(schema).not.toHaveProperty("about");
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
    expect(schema).not.toHaveProperty("about");
  });

});
