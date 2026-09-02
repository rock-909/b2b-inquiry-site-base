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
  getTranslations: vi.fn(
    async () => (key: string, values?: Record<string, string>) => {
      const copy: Record<string, string> = {
        "detail.backToProducts": "Back to products",
        "detail.factsEyebrow": "Product facts",
        "detail.applicationsTitle": "Applications and buyer fit",
        "detail.specificationsTitle": "Technical specifications",
        "detail.materialsTitle": "Materials and construction",
        "detail.configurationTitle": "Configuration and selection",
        "detail.deliveryTitle": "Delivery boundary",
        "detail.evidenceTitle": "Verifiable evidence",
        "detail.startInquiry": "Get a quote",
        "detail.inquirySectionTitle": "Inquire about {productName}",
        // inquiry.form 命名空间的预填模板（tForm 不带前缀调用）。
        productInterestTemplate: "I'm interested in {productName}.",
      };
      const raw = copy[key] ?? key;
      if (!values) return raw;
      return Object.entries(values).reduce(
        (acc, [k, v]) => acc.replaceAll(`{${k}}`, v),
        raw,
      );
    },
  ),
}));

// 产品页内嵌表单区块 mock（行为证明在组件测试与 e2e）。
vi.mock("@/components/sections/immediate-inquiry-form-section", () => ({
  ImmediateInquiryFormSection: (props: Record<string, unknown>) => (
    <section
      data-testid="embedded-inquiry-section"
      data-id={props.id as string | undefined}
      data-title={props.title as string}
      data-initial-message={props.initialMessage as string | undefined}
    />
  ),
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
    for (const heading of [
      "Applications and buyer fit",
      "Technical specifications",
      "Materials and construction",
      "Configuration and selection",
      "Delivery boundary",
      "Verifiable evidence",
    ]) {
      expect(
        screen.getByRole("heading", { level: 2, name: heading }),
      ).toBeInTheDocument();
    }
    expect(screen.getByText("Dimensions or capacity")).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: "Get a quote" });
    expect(cta).toHaveAttribute("href", "#inquiry");

    // 内嵌表单区块：SSR 锚点 id + 插值标题 + 产品语境预填。
    expect(screen.getByTestId("embedded-inquiry-section")).toHaveAttribute(
      "data-id",
      "inquiry",
    );
    expect(screen.getByTestId("embedded-inquiry-section")).toHaveAttribute(
      "data-title",
      "Inquire about Sample Offering",
    );
    expect(screen.getByTestId("embedded-inquiry-section")).toHaveAttribute(
      "data-initial-message",
      "I'm interested in Sample Offering.",
    );
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
