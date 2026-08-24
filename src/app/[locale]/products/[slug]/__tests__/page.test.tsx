import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductDetailPage, {
  generateMetadata,
  generateStaticParams,
} from "../page";

const { mockGenerateMetadataForPath, mockJsonLdGraphScript, mockNotFound } =
  vi.hoisted(() => ({
    mockGenerateMetadataForPath: vi.fn(() => ({ title: "Sample Offering" })),
    mockJsonLdGraphScript: vi.fn(),
    mockNotFound: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
  }));

vi.mock("next/navigation", () => ({ notFound: mockNotFound }));
vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async () => (key: string) => {
    const copy: Record<string, string> = {
      "detail.backToProducts": "Back to products",
      "detail.highlightsTitle": "Highlights",
      "detail.requestQuote": "Request a quote",
    };
    return copy[key] ?? key;
  }),
}));
vi.mock("@/i18n/routing", () => ({
  routing: { locales: ["en"] },
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/seo-metadata", () => ({
  generateMetadataForPath: mockGenerateMetadataForPath,
}));
vi.mock("@/components/seo/json-ld-script", () => ({
  JsonLdGraphScript: ({
    locale,
    data = [],
  }: {
    locale: string;
    data?: unknown[];
  }) => {
    mockJsonLdGraphScript({ locale, data });
    return null;
  },
}));

const SAMPLE_PARAMS = Promise.resolve({
  locale: "en",
  slug: "sample-offering",
});

describe("ProductDetailPage", () => {
  beforeEach(() => {
    mockGenerateMetadataForPath.mockClear();
    mockJsonLdGraphScript.mockClear();
    mockNotFound.mockClear();
  });

  it("pre-renders every configured offering", () => {
    expect(generateStaticParams()).toEqual([
      { locale: "en", slug: "sample-offering" },
    ]);
  });

  it("renders one canonical offering and its inquiry CTA", async () => {
    render(await ProductDetailPage({ params: SAMPLE_PARAMS }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Sample Offering" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request a quote" }),
    ).toHaveAttribute("href", "/contact");
    expect(mockJsonLdGraphScript).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "en",
        data: expect.arrayContaining([
          expect.objectContaining({
            "@type": "Product",
            name: "Sample Offering",
          }),
          expect.objectContaining({ "@type": "BreadcrumbList" }),
        ]),
      }),
    );
  });

  it("builds product metadata from the resolved offering", async () => {
    await generateMetadata({ params: SAMPLE_PARAMS });

    expect(mockGenerateMetadataForPath).toHaveBeenCalledWith(
      expect.objectContaining({
        pageType: "products",
        path: "/products/sample-offering",
        config: expect.objectContaining({
          title: "Sample Offering",
          type: "product",
        }),
      }),
    );
  });

  it("returns not found for an unknown product", async () => {
    await expect(
      ProductDetailPage({
        params: Promise.resolve({ locale: "en", slug: "unknown-product" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
