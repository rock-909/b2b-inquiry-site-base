import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PrivacyPage, { generateMetadata } from "@/app/[locale]/privacy/page";
import type { Locale } from "@/types/content.types";

const { mockLoadLegalPage, mockGenerateMetadataForPath } = vi.hoisted(() => ({
  mockLoadLegalPage: vi.fn(),
  mockGenerateMetadataForPath: vi.fn(),
}));

vi.mock("@/lib/content/legal-page", () => ({
  loadLegalPage: mockLoadLegalPage,
}));

vi.mock("@/lib/seo-metadata", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/seo-metadata")>();
  return {
    ...actual,
    generateMetadataForPath: mockGenerateMetadataForPath,
  };
});

vi.mock("@/components/content/legal-page-shell", () => ({
  LegalPageShell: vi.fn(
    ({
      metadata,
      headings,
      schemaType,
    }: {
      metadata: { title: string };
      headings: Array<{ id: string; text: string }>;
      schemaType: string;
    }) => (
      <div data-schema-type={schemaType}>
        <h1>{metadata.title}</h1>
        <nav aria-label="Table of Contents">
          {headings.map((heading) => (
            <a key={heading.id} href={`#${heading.id}`}>
              {heading.text}
            </a>
          ))}
        </nav>
      </div>
    ),
  ),
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
}));

const createParams = (locale: Locale) => ({
  locale,
});

const mockLegalPage = {
  metadata: {
    title: "Privacy Policy",
    description: "How we collect, use, and protect your data.",
    slug: "privacy",
    publishedAt: "2024-01-01",
    updatedAt: "2024-02-01",
    layout: "legal" as const,
    showToc: true as const,
    lastReviewed: "2024-02-01",
    seo: {
      title: "Privacy Policy SEO",
      description: "Privacy SEO description",
    },
  },
  content: "## Information We Collect {#info-collect}\n\nWe collect data.",
  headings: [
    { level: 2 as const, text: "Information We Collect", id: "info-collect" },
  ],
};

describe("Privacy Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadLegalPage.mockResolvedValue(mockLegalPage);
    mockGenerateMetadataForPath.mockReturnValue({
      title: "Privacy Policy SEO",
      description: "Privacy SEO description",
    });
  });

  it("应该用 MDX frontmatter 生成 metadata", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve(createParams("en")),
    });

    expect(metadata.title).toBe("Privacy Policy SEO");
    expect(metadata.description).toBe("Privacy SEO description");
    expect(mockLoadLegalPage).toHaveBeenCalledWith("privacy", "en");
    expect(mockGenerateMetadataForPath).toHaveBeenCalledWith({
      locale: "en",
      pageType: "privacy",
      path: "/privacy",
      config: {
        title: "Privacy Policy SEO",
        description: "Privacy SEO description",
      },
    });
  });

  it("应该保留 legal 旧逻辑里的空 description", async () => {
    mockLoadLegalPage.mockResolvedValueOnce({
      ...mockLegalPage,
      metadata: {
        ...mockLegalPage.metadata,
        seo: {
          title: "Privacy Policy SEO",
          description: "",
        },
      },
    });

    await generateMetadata({
      params: Promise.resolve(createParams("en")),
    });

    expect(mockGenerateMetadataForPath).toHaveBeenCalledWith({
      locale: "en",
      pageType: "privacy",
      path: "/privacy",
      config: {
        title: "Privacy Policy SEO",
        description: "",
      },
    });
  });

  it("直接渲染法务正文，不留任何流式边界", async () => {
    render(
      await PrivacyPage({
        params: Promise.resolve(createParams("en")),
      }),
    );

    // 正文必须是页面自己 await 出来的结果。挂在 Suspense 后面会让正文流到
    // <main> 外的隐藏容器，禁用脚本的访客只剩骨架屏。
    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy Policy" }),
    ).toBeInTheDocument();
    expect(document.querySelectorAll(".animate-pulse")).toHaveLength(0);
  });
});
