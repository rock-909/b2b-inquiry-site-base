import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateMetadata as generatePrivacyMetadata } from "@/app/[locale]/privacy/page";
import { generateMetadata as generateTermsMetadata } from "@/app/[locale]/terms/page";

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

vi.mock("next-intl/server", () => ({}));

const LEGAL_PAGES = [
  {
    pageType: "privacy",
    path: "/privacy",
    generateMetadata: generatePrivacyMetadata,
  },
  {
    pageType: "terms",
    path: "/terms",
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
  ({ pageType, path, generateMetadata }) => {
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
  },
);
