import { describe, expect, it, vi } from "vitest";

const mockGetStaticPage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/static-pages", () => ({
  getStaticPage: mockGetStaticPage,
}));

import { extractHeadingsFromContent, loadLegalPage } from "../legal-page";

const SENTINEL_BLOCKS = [
  { kind: "heading", level: "h2", displayText: "Sentinel Scope", id: "scope" },
] as never[];
vi.mock("@/lib/content/static-markdown-blocks", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/content/static-markdown-blocks")
    >();
  return {
    ...actual,
    // 默认转发真实实现；仅单次解析合同测试中覆盖为 sentinel。
    parseStaticMarkdownBlocks: vi.fn(actual.parseStaticMarkdownBlocks),
  };
});

describe("loadLegalPage", () => {
  it("loads and narrows to LegalPageMetadata", async () => {
    mockGetStaticPage.mockReturnValueOnce({
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
      filePath: "/src/content/pages/en/privacy.ts",
    });

    const result = await loadLegalPage("privacy", "en");
    expect(result.metadata.title).toBe("Privacy Policy");
    expect(result.metadata.layout).toBe("legal");
    expect(result.metadata.showToc).toBe(true);
    expect(result.metadata.lastReviewed).toBe("2024-04-01");
  });

  it("falls back to updatedAt when lastReviewed is absent", async () => {
    mockGetStaticPage.mockReturnValueOnce({
      metadata: {
        title: "Terms",
        slug: "terms",
        publishedAt: "2024-01-01",
        updatedAt: "2024-06-15",
      },
      content: "## Terms",
      slug: "terms",
      filePath: "/src/content/pages/en/terms.ts",
    });

    const result = await loadLegalPage("terms", "en");
    expect(result.metadata.lastReviewed).toBe("2024-06-15");
  });

  it("falls back to publishedAt when both lastReviewed and updatedAt are absent", async () => {
    mockGetStaticPage.mockReturnValueOnce({
      metadata: {
        title: "Terms",
        slug: "terms",
        publishedAt: "2024-01-01",
      },
      content: "## Terms",
      slug: "terms",
      filePath: "/src/content/pages/en/terms.ts",
    });

    const result = await loadLegalPage("terms", "en");
    expect(result.metadata.lastReviewed).toBe("2024-01-01");
  });
});

describe("single-parse contract", () => {
  it("parses content once and shares the result between body and TOC", async () => {
    mockGetStaticPage.mockReturnValueOnce({
      metadata: {
        title: "Privacy Policy",
        slug: "privacy",
        publishedAt: "2024-01-01",
      },
      content: "## Scope\n\nBody text.",
    });

    // 通过动态导入拿到被 vi.mock 替换后的绑定。
    const { parseStaticMarkdownBlocks } = await import(
      "@/lib/content/static-markdown-blocks"
    );
    const parseMock = vi.mocked(parseStaticMarkdownBlocks);
    parseMock.mockClear();
    parseMock.mockReturnValueOnce(SENTINEL_BLOCKS as never);

    const page = loadLegalPage("privacy", "en");

    // loader 只做一次解析；TOC 与正文消费同一份块序列（identity 级传递）。
    expect(parseMock).toHaveBeenCalledTimes(1);
    expect(page.blocks).toBe(SENTINEL_BLOCKS);
    expect(page.headings).toEqual([
      { level: 2, text: "Sentinel Scope", id: "scope" },
    ]);
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
