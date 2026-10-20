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

describe("LegalPageShell structured data", () => {
  it("Given privacy legal metadata, When the shell renders, Then WebPage JSON-LD uses the page URL graph", async () => {
    const pageUrl = "https://www.example.com/privacy";
    const schema = await buildShellPageSchema({
      metadata: {
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
  });

});
