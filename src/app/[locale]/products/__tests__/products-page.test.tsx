import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocaleParam } from "@/app/[locale]/generate-static-params";
import ProductsPage, { generateStaticParams } from "../page";
import { singleSiteProductCatalog } from "@/config/single-site-product-catalog";
import {
  assertNoHeavyCatalogOrDeveloperDemoCopy,
  createCatalogTranslator,
  mockCatalogTranslationsEn,
} from "./mocks/products-test-fixtures";

const {
  mockBuildCatalogBreadcrumbJsonLd,
  mockCatalogBreadcrumb,
  mockGetTranslations,
} = vi.hoisted(() => ({
  mockBuildCatalogBreadcrumbJsonLd: vi.fn(),
  mockCatalogBreadcrumb: vi.fn(() => (
    <nav data-testid="breadcrumb">Products</nav>
  )),
  mockGetTranslations: vi.fn(),
}));

vi.mock("@/config/single-site-seo", () => ({
  hasSingleSiteDynamicSurface: vi.fn(() => false),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: mockGetTranslations,
  setRequestLocale: vi.fn(),
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  routing: {
    locales: ["en"],
    defaultLocale: "en",
  },
}));

vi.mock("@/components/products/catalog-breadcrumb", () => ({
  CatalogBreadcrumb: mockCatalogBreadcrumb,
}));

vi.mock("@/components/products/catalog-breadcrumb-jsonld", () => ({
  buildCatalogBreadcrumbJsonLd: mockBuildCatalogBreadcrumbJsonLd,
}));

vi.mock("@/components/seo/json-ld-script", () => ({
  JsonLdGraphScript: () => <script type="application/ld+json" />,
  JsonLdScript: () => <script type="application/ld+json" />,
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    fill: _fill,
    sizes: _sizes,
    className,
  }: {
    src: string;
    alt: string;
    fill?: boolean;
    sizes?: string;
    className?: string;
  }) => (
    // img is acceptable in a test stub — next/image is not available in vitest jsdom
    <img src={src} alt={alt} className={className} />
  ),
}));

vi.mock("@/app/[locale]/generate-static-params", () => ({
  generateLocaleStaticParams: () => [{ locale: "en" }],
}));

async function renderAsyncComponent(
  component: Promise<React.JSX.Element> | React.JSX.Element,
) {
  const resolved = await Promise.resolve(component);
  return render(resolved);
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });

  return { promise, resolve };
}

async function flushPendingMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("Feature: Product Overview Page", () => {
  const mockParams: LocaleParam = { locale: "en" };
  const RETIRED_BENDING_MACHINES_PATH = "/capabilities/bending-machines";
  const PRODUCT_LINE_LINKS = [
    ["ABS Interlocking Boxwall Flood Barriers", "/products/abs-flood-barriers"],
    [
      "Aluminum Flood Gates & Demountable Barrier Systems",
      "/products/aluminum-flood-gates",
    ],
    [
      "Absorbent Flood Bags (Sandless Sandbags)",
      "/products/absorbent-flood-bags",
    ],
    ["Water & Air-Filled Tube Dams", "/products/flood-tube-dams"],
    ["FRP Composite Planks", "/products/frp-flood-barriers"],
  ] as const;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTranslations.mockImplementation(
      async ({ locale }: { locale: string }) => createCatalogTranslator(locale),
    );
    mockBuildCatalogBreadcrumbJsonLd.mockResolvedValue({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [],
    });
  });

  describe("Scenario 2.1: Visitor sees light product overview cards", () => {
    it("renders the overview cards section heading", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      expect(
        screen.getByText("Start with the product line"),
      ).toBeInTheDocument();
    });

    it("renders all five Tucsenberg product-line cards", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      for (const [label, href] of PRODUCT_LINE_LINKS) {
        expect(screen.getByRole("link", { name: label })).toHaveAttribute(
          "href",
          href,
        );
      }
    });

    it("does not render market overview cards or heavy catalog demo copy", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      expect(
        document.querySelector('[data-testid^="market-card-"]'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Primary Offer Example"),
      ).not.toBeInTheDocument();

      assertNoHeavyCatalogOrDeveloperDemoCopy();
    });
  });

  describe("Scenario 2.1b: Prioritized product-system composition leads to inquiry", () => {
    it("renders product-line cards in the approved P1-P5 order", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      const lineHeadings = PRODUCT_LINE_LINKS.map(([label]) =>
        screen.getByRole("heading", { level: 3, name: label }),
      );

      for (let index = 0; index < lineHeadings.length - 1; index += 1) {
        const current = lineHeadings[index];
        const next = lineHeadings[index + 1];
        if (!current || !next) {
          throw new Error("Expected adjacent product line headings");
        }
        expect(
          current.compareDocumentPosition(next) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
    });

    it("shows product-fit guidance before the RFQ CTA", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      expect(screen.getByText("Scan the five lines")).toBeInTheDocument();
      expect(screen.getByText("Check the fit")).toBeInTheDocument();
      expect(screen.getByText("Send the RFQ")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Standard items are quoted in 12 hours; custom configurations within 48.",
        ),
      ).toBeInTheDocument();

      const rfqLink = screen.getByRole("link", { name: "Request a Quote" });
      expect(rfqLink.getAttribute("href")).toBe("/request-quote");
      expect(rfqLink.getAttribute("href")).toMatch(/\/request-quote$/);
    });
  });

  describe("Scenario 2.2: Visitor sees replacement boundary", () => {
    it("renders the honest launch boundary", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      expect(screen.getByText("No published-price games")).toBeInTheDocument();
      expect(
        screen.getByText("Prices stay in the quotation, not on public pages"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Custom-cut and private label details are confirmed per order",
        ),
      ).toBeInTheDocument();

      assertNoHeavyCatalogOrDeveloperDemoCopy();
    });

    it("does not render the retired equipment card", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      expect(
        screen.queryByText("overview.equipmentTitle"),
      ).not.toBeInTheDocument();
      expect(
        document.querySelector(`a[href="${RETIRED_BENDING_MACHINES_PATH}"]`),
      ).not.toBeInTheDocument();
    });
  });

  describe("Scenario 2.2b: Visitor sees product overview routing guidance", () => {
    it("renders the reusable product overview path and detail-page upgrade guidance", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      expect(
        screen.getByRole("heading", {
          level: 2,
          name: "How this overview should work",
        }),
      ).toBeInTheDocument();
      expect(screen.getByText("Scan the five lines")).toBeInTheDocument();
      expect(screen.getByText("Check the fit")).toBeInTheDocument();
      expect(screen.getByText("Send the RFQ")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", {
          level: 2,
          name: "When to open a product page",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Product family, material and deployment method affect the recommendation",
        ),
      ).toBeInTheDocument();
    });

    it("keeps the overview guidance lightweight without detail links or downloads", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      const hrefs = screen
        .getAllByRole("link")
        .map((link) => link.getAttribute("href"));

      expect(hrefs).toEqual(
        expect.arrayContaining([
          "/guides/flood-barrier-materials-guide",
          "/guides/flood-barrier-specifications",
          "/request-quote",
        ]),
      );
      for (const [, href] of PRODUCT_LINE_LINKS) {
        expect(hrefs).toContain(href);
      }
      expect(hrefs.some((href) => href?.includes("download"))).toBe(false);
      expect(hrefs.some((href) => href?.endsWith(".pdf"))).toBe(false);
      expect(hrefs.some((href) => href?.startsWith("/api/"))).toBe(false);
      expect(hrefs.some((href) => href?.includes("login"))).toBe(false);
    });
  });

  describe("Scenario 2.3: Breadcrumb shows root level (no market)", () => {
    it("renders breadcrumb without a market argument", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      const breadcrumb = screen.getByTestId("breadcrumb");
      expect(breadcrumb).toBeInTheDocument();
      expect(breadcrumb).toHaveTextContent("Products");
    });

    // 从 page.test.tsx 并过来的唯一独有断言，那个文件其余四条都是这里的子集。
    it("opts only the products listing breadcrumb home link out of prefetch", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      expect(mockCatalogBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          homePrefetch: false,
          renderJsonLd: false,
        }),
        undefined,
      );
    });
  });

  describe("Scenario 2.4: Page header and CTAs", () => {
    it("renders the h1 page title", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "Flood Barrier Product Lines",
        }),
      ).toBeInTheDocument();
    });

    it("does not repeat the product label as a header kicker below the breadcrumb", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      expect(screen.getAllByText("Products")).toHaveLength(1);
    });

    it("renders the page description", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      expect(
        screen.getByText(
          "Five flood barrier lines for dealers, importers, brands, contractors and small business buyers: ABS boxwall, aluminum flood gates, absorbent flood bags, tube dams and FRP composite planks.",
        ),
      ).toBeInTheDocument();
    });

    it("renders guide and RFQ CTAs without retired blog/resources/contact links", async () => {
      await renderAsyncComponent(
        ProductsPage({ params: Promise.resolve(mockParams) }),
      );

      expect(screen.getByRole("link", { name: "View guides" })).toHaveAttribute(
        "href",
        "/guides/flood-barrier-materials-guide",
      );
      expect(
        screen.getByRole("link", { name: "View specifications guide" }),
      ).toHaveAttribute("href", "/guides/flood-barrier-specifications");
      expect(
        screen.getByRole("link", { name: "Request a Quote" }),
      ).toHaveAttribute("href", "/request-quote");

      const hrefs = screen
        .getAllByRole("link")
        .map((link) => link.getAttribute("href"));

      // Asserting the whole link set instead of a list of forbidden paths: the
      // old form only caught the three dead routes someone thought to name, and
      // silently allowed any other stray link. Markets come from config so a new
      // product line does not fail this for the wrong reason.
      expect([...new Set(hrefs)].sort()).toEqual(
        [
          "/guides/flood-barrier-materials-guide",
          "/guides/flood-barrier-specifications",
          "/request-quote",
          ...singleSiteProductCatalog.markets.map(
            (market) => `/products/${market.slug}`,
          ),
        ].sort(),
      );
    });
  });

  describe("Scenario 2.5: Async Server Component contract", () => {
    it("is an async server component (returns a Promise)", () => {
      const result = ProductsPage({ params: Promise.resolve(mockParams) });
      expect(result).toBeInstanceOf(Promise);
    });

    it("generates only the active English locale", () => {
      expect(generateStaticParams()).toEqual([{ locale: "en" }]);
    });
  });

  describe("Scenario 2.6: Independent server work starts together", () => {
    it("starts translations and breadcrumb schema generation before either result resolves", async () => {
      const translations = createDeferred<(key: string) => string>();
      const breadcrumbSchema = createDeferred<Record<string, unknown>>();
      mockGetTranslations.mockReturnValueOnce(translations.promise);
      mockBuildCatalogBreadcrumbJsonLd.mockReturnValueOnce(
        breadcrumbSchema.promise,
      );

      const page = ProductsPage({ params: Promise.resolve(mockParams) });

      await flushPendingMicrotasks();

      expect(mockGetTranslations).toHaveBeenCalledWith({
        locale: "en",
        namespace: "catalog",
      });
      expect(mockBuildCatalogBreadcrumbJsonLd).toHaveBeenCalledWith({});

      translations.resolve(
        (key: string) =>
          mockCatalogTranslationsEn[
            key as keyof typeof mockCatalogTranslationsEn
          ] || key,
      );
      breadcrumbSchema.resolve({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [],
      });
      await page;
    });
  });
});
