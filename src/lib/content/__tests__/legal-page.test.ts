import { describe, expect, it, vi } from "vitest";

const mockGetPageBySlug = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content-query/queries", () => ({
  getPageBySlug: mockGetPageBySlug,
}));

import { extractHeadingsFromContent, loadLegalPage } from "../legal-page";

describe("loadLegalPage", () => {
  it("loads and narrows to LegalPageMetadata", async () => {
    mockGetPageBySlug.mockResolvedValueOnce({
      metadata: {
        title: "Privacy Policy",
        slug: "privacy",
        publishedAt: "2024-01-01",
        updatedAt: "2024-04-01",
        lastReviewed: "2024-04-01",
        layout: "legal",
        showToc: true,
        seo: {
          title: "Privacy Policy | Data Protection",
          description: "Our privacy policy.",
        },
      },
      content:
        "## Introduction\n\nWe care about your privacy.\n\n## Information We Collect\n\nWe collect the following.\n\n### Personal Data\n\nName, email.",
      slug: "privacy",
      filePath: "content/pages/en/privacy.mdx",
    });

    const result = await loadLegalPage("privacy", "en");
    expect(result.metadata.title).toBe("Privacy Policy");
    expect(result.metadata.layout).toBe("legal");
    expect(result.metadata.showToc).toBe(true);
    expect(result.metadata.lastReviewed).toBe("2024-04-01");
  });

  it("falls back to updatedAt when lastReviewed is absent", async () => {
    mockGetPageBySlug.mockResolvedValueOnce({
      metadata: {
        title: "Terms",
        slug: "terms",
        publishedAt: "2024-01-01",
        updatedAt: "2024-06-15",
      },
      content: "## Terms",
      slug: "terms",
      filePath: "content/pages/en/terms.mdx",
    });

    const result = await loadLegalPage("terms", "en");
    expect(result.metadata.lastReviewed).toBe("2024-06-15");
  });

  it("falls back to publishedAt when both lastReviewed and updatedAt are absent", async () => {
    mockGetPageBySlug.mockResolvedValueOnce({
      metadata: {
        title: "Terms",
        slug: "terms",
        publishedAt: "2024-01-01",
      },
      content: "## Terms",
      slug: "terms",
      filePath: "content/pages/en/terms.mdx",
    });

    const result = await loadLegalPage("terms", "en");
    expect(result.metadata.lastReviewed).toBe("2024-01-01");
  });
});

describe("extractHeadingsFromContent", () => {
  it("extracts H2 and H3 headings with slugified IDs", () => {
    const content =
      "## Introduction\n\nText.\n\n## Information We Collect\n\n### Personal Data\n\nMore text.";
    const headings = extractHeadingsFromContent(content);

    expect(headings).toEqual([
      { level: 2, text: "Introduction", id: "introduction" },
      {
        level: 2,
        text: "Information We Collect",
        id: "information-we-collect",
      },
      { level: 3, text: "Personal Data", id: "personal-data" },
    ]);
  });

  it("uses explicit anchor ID when present via {#id} syntax", () => {
    const content =
      "## Introduction {#intro}\n\n## How We Use Your Data {#data-use}\n\n### Cookies {#cookies-policy}";
    const headings = extractHeadingsFromContent(content);

    expect(headings).toEqual([
      { level: 2, text: "Introduction", id: "intro" },
      { level: 2, text: "How We Use Your Data", id: "data-use" },
      { level: 3, text: "Cookies", id: "cookies-policy" },
    ]);
  });

  it("explicit ID remains stable when heading text changes", () => {
    const v1 = extractHeadingsFromContent(
      "## Information Collection {#info-collect}",
    );
    const v2 = extractHeadingsFromContent(
      "## What Information We Collect {#info-collect}",
    );

    expect(v1).toHaveLength(1);
    expect(v2).toHaveLength(1);
    expect(v1[0]?.id).toBe("info-collect");
    expect(v2[0]?.id).toBe("info-collect");
    expect(v1[0]?.id).toBe(v2[0]?.id);
  });

  it("returns empty array for content with no headings", () => {
    expect(extractHeadingsFromContent("Just a paragraph.")).toEqual([]);
  });
});
