import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PrivacyPage, {
  generateMetadata as generatePrivacyMetadata,
} from "@/app/[locale]/privacy/page";
import TermsPage, {
  generateMetadata as generateTermsMetadata,
} from "@/app/[locale]/terms/page";

const { mockLoadLegalPage, mockGenerateMetadataForPath } = vi.hoisted(() => ({
  mockLoadLegalPage: vi.fn(),
  mockGenerateMetadataForPath: vi.fn(),
}));

vi.mock("@/lib/content/legal-page", () => ({
  loadLegalPage: mockLoadLegalPage,
}));

vi.mock(import("@/lib/seo-metadata"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    generateMetadataForPath: mockGenerateMetadataForPath,
  };
});

vi.mock("@/components/content/legal-page-shell", () => ({
  LegalPageShell: vi.fn(({ metadata }: { metadata: { title: string } }) => (
    <h1>{metadata.title}</h1>
  )),
}));

vi.mock("next-intl/server", () => ({}));

const LEGAL_PAGES = [
  {
    pageType: "privacy",
    path: "/privacy",
    Page: PrivacyPage,
    generateMetadata: generatePrivacyMetadata,
  },
  {
    pageType: "terms",
    path: "/terms",
    Page: TermsPage,
    generateMetadata: generateTermsMetadata,
  },
] as const;

const legalPage = {
  metadata: {
    title: "Legal page title",
    description: "Legal page description",
    publishedAt: "2024-01-01",
    updatedAt: "2024-02-01",
    seo: {
      title: "Legal SEO title",
      description: "Legal SEO description",
      ogImage: "/legal-og.png",
    },
  },
  blocks: [],
  headings: [],
};

describe.each(LEGAL_PAGES)(
  "$pageType page",
  ({ pageType, path, Page, generateMetadata }) => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockLoadLegalPage.mockResolvedValue(legalPage);
    });

    it("builds metadata for its own route from the static page SEO fields", async () => {
      await generateMetadata({ params: Promise.resolve({ locale: "en" }) });

      expect(mockLoadLegalPage).toHaveBeenCalledWith(pageType, "en");
      expect(mockGenerateMetadataForPath).toHaveBeenCalledWith({
        locale: "en",
        pageType,
        path,
        config: {
          title: "Legal SEO title",
          description: "Legal SEO description",
          image: "/legal-og.png",
        },
      });
    });

    it("renders the loaded legal page directly, with no streaming boundary", async () => {
      // 正文必须是页面自己 await 出来的结果。挂在 Suspense 后面会让正文流到
      // <main> 外的隐藏容器，禁用脚本的访客只剩骨架屏。
      render(await Page({ params: Promise.resolve({ locale: "en" }) }));

      expect(mockLoadLegalPage).toHaveBeenCalledWith(pageType, "en");
      expect(
        screen.getByRole("heading", { level: 1, name: "Legal page title" }),
      ).toBeInTheDocument();
    });
  },
);
