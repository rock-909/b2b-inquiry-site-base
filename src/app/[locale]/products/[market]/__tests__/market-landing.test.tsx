import React from "react";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNotFound = vi.fn();
const mockGetTranslations = vi.fn();
const mockCatalogBreadcrumb = vi.hoisted(() => vi.fn());
const mockJsonLdGraphScript = vi.hoisted(() => vi.fn());
const mockPathsConfig = vi.hoisted(() => ({
  SITE_CONFIG: {
    name: "Tucsenberg",
    baseUrl: "https://www.example.com",
    brandAssets: {
      productPhotos: {
        status: "pending",
      },
    },
    seo: {
      defaultTitle: "Tucsenberg",
      defaultDescription: "Tucsenberg flood barrier catalog",
    },
  },
  LOCALES_CONFIG: {
    locales: ["en"],
    defaultLocale: "en",
  },
  PATHS_CONFIG: {
    pages: {
      products: "/products",
    },
  },
  DYNAMIC_PATHS_CONFIG: {
    productMarket: {
      pattern: "/products/[market]",
      paramName: "market",
    },
  },
}));

type MockHref =
  | string
  | {
      pathname: string;
      query?: Record<string, string>;
    };
type TestProductImage =
  { status: "real"; src: string } | { status: "pending" | "omitted" };

function stringifyMockHref(href: MockHref) {
  if (typeof href === "string") {
    return href;
  }

  const query = href.query ? `?${new URLSearchParams(href.query)}` : "";
  return `${href.pathname}${query}`;
}

function findProductSchemaNode(data: readonly unknown[]) {
  const product = data.find(
    (item) =>
      item !== null &&
      typeof item === "object" &&
      (item as { "@type"?: unknown })["@type"] === "Product",
  );

  if (product === null || typeof product !== "object") {
    throw new Error("Product node missing from JSON-LD test payload");
  }

  return product as Record<string, unknown>;
}

vi.mock("next/navigation", () => ({
  notFound: () => {
    mockNotFound();
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("next-intl/server", () => ({
  getTranslations: mockGetTranslations,
  setRequestLocale: vi.fn(),
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({
    href,
    children,
    className,
    prefetch,
  }: {
    href: MockHref;
    children: React.ReactNode;
    className?: string;
    prefetch?: boolean;
  }) => (
    <a
      href={stringifyMockHref(href)}
      className={className}
      data-prefetch={prefetch === undefined ? "default" : String(prefetch)}
    >
      {children}
    </a>
  ),
  routing: {
    locales: ["en"],
    defaultLocale: "en",
  },
}));

vi.mock("@/config/paths", () => ({
  ...mockPathsConfig,
  getLocalizedPath: (pageType: string) =>
    pageType === "products" ? "/products" : "/",
  getProductMarketPath: (market: string) => `/products/${market}`,
}));

vi.mock("@/components/products/catalog-breadcrumb", () => ({
  CatalogBreadcrumb: mockCatalogBreadcrumb,
}));

vi.mock("@/components/products/catalog-breadcrumb-jsonld", () => ({
  buildCatalogBreadcrumbJsonLd: vi.fn(async () => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [],
  })),
}));

vi.mock("@/components/seo/json-ld-script", () => ({
  JsonLdGraphScript: ({
    locale,
    data = [],
  }: {
    locale: string;
    data?: readonly unknown[];
  }) => {
    mockJsonLdGraphScript({ locale, data });
    return <script type="application/ld+json" data-testid="json-ld-graph" />;
  },
}));

vi.mock("@/lib/content-query/queries", () => ({
  getPageBySlug: vi.fn(async () => ({
    metadata: {
      faq: [
        {
          id: "market-faq",
          question: "Market FAQ?",
          answer: "Market FAQ answer.",
        },
      ],
    },
  })),
}));

const MOCK_TRANSLATIONS: Record<string, string> = {
  "markets.abs-flood-barriers.label": "ABS Interlocking Boxwall",
  "markets.abs-flood-barriers.description":
    "Freestanding ABS interlocking flood barriers for driveways, doorways and paved perimeters.",
  "markets.aluminum-flood-gates.label": "Aluminum Flood Gates",
  "markets.aluminum-flood-gates.description":
    "Demountable aluminum plank systems for doors, garages, loading docks and shopfronts.",
  "markets.flood-tube-dams.label": "Water & Air-Filled Tube Dams",
  "markets.flood-tube-dams.description":
    "Inflatable PVC tube dams for long runs, rough ground and planned emergency stock.",
  "market.technical.title": "Technical Properties",
  "market.certifications.title": "Certifications & Compliance",
  "market.trade.title": "Trade Information",
  "market.trade.moq": "Minimum Order",
  "market.trade.leadTime": "Lead Time",
  "market.trade.supplyCapacity": "Supply Capacity",
  "market.trade.packaging": "Packaging",
  "market.trade.portOfLoading": "Port of Loading",
  "market.cta.heading": "Need {marketLabel} products?",
  "market.cta.description":
    "Request a quote or ask about specifications, MOQ, and lead times.",
  "market.cta.button": "Request a Quote",
  faqTitle: "FAQ",
  finalCtaTitle: "Request a quote",
  rfqNoteFallback:
    "Tell us the opening or perimeter, ground type, quantity, market and timeline. Photos and drawings help us give a cleaner answer.",
  downloadSpec: "Download spec sheet",
};

describe("Market Landing Page", () => {
  beforeEach(() => {
    vi.resetModules();
    mockPathsConfig.SITE_CONFIG.baseUrl = "https://www.example.com";
    mockNotFound.mockClear();
    mockJsonLdGraphScript.mockClear();
    mockCatalogBreadcrumb.mockReset();
    mockCatalogBreadcrumb.mockImplementation(() => (
      <nav aria-label="breadcrumb">Breadcrumb</nav>
    ));
    mockGetTranslations.mockReset();
    mockGetTranslations.mockResolvedValue(
      (key: string, params?: Record<string, string>) => {
        let value = MOCK_TRANSLATIONS[key] ?? key;
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            value = value.replace(`{${k}}`, v);
          }
        }
        return value;
      },
    );
  });

  async function renderPage(market: string, locale = "en") {
    const { default: MarketPage } = await import("../page");
    const page = await MarketPage({
      params: Promise.resolve({ locale, market }),
    });
    return render(page);
  }

  async function generatePageMetadata(market: string, locale = "en") {
    const { generateMetadata } = await import("../page");
    return generateMetadata({
      params: Promise.resolve({ locale, market }),
    });
  }

  async function buildAbsProductSchemaForImage(image: TestProductImage) {
    const { buildMarketPageJsonLdData } = await import("../market-jsonld");
    const { getMarketBySlug } = await import("@/constants/product-catalog");
    const { TUCSENBERG_PRODUCT_PAGES } =
      await import("@/constants/tucsenberg-product-pages");
    const market = getMarketBySlug("abs-flood-barriers");

    if (!market) {
      throw new Error("ABS flood barriers market fixture missing");
    }

    const data = await buildMarketPageJsonLdData({
      market,
      marketUrl: "https://www.example.com/products/abs-flood-barriers",
      productPage: {
        ...TUCSENBERG_PRODUCT_PAGES["abs-flood-barriers"],
        image,
      },
    });

    return findProductSchemaNode(data);
  }

  describe("Scenario 1.1: Page renders with title and standard label", () => {
    it("renders the market title as h1 and standard label badge", async () => {
      await renderPage("abs-flood-barriers");

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveTextContent(
        "ABS Interlocking Boxwall Flood Barriers",
      );

      const header = heading.closest("header");
      expect(header).not.toBeNull();
      expect(
        within(header as HTMLElement).getByText("TB-BW series"),
      ).toBeInTheDocument();
    });

    it("renders the market description", async () => {
      await renderPage("abs-flood-barriers");

      expect(
        screen.getByText(/A freestanding flood barrier that needs no bolts/),
      ).toBeInTheDocument();
    });

    it("renders product CTA links through the shared catalog query contract", async () => {
      await renderPage("abs-flood-barriers");

      const quoteLinks = screen.getAllByRole("link", {
        name: /request a quote/i,
      });

      expect(quoteLinks[0]).toHaveAttribute(
        "href",
        "/request-quote?catalogProductId=abs-flood-barriers",
      );
    });

    it("uses the FRP catalog slug instead of legacy interest handoffs", async () => {
      await renderPage("frp-flood-barriers");

      const registerLink = screen
        .getAllByRole("link", {
          name: "Register interest",
        })
        .at(0);
      expect(registerLink).toBeDefined();

      expect(registerLink).toHaveAttribute(
        "href",
        "/request-quote?catalogProductId=frp-flood-barriers",
      );
      expect(registerLink?.getAttribute("href")).not.toContain("interest=");
    });

    it("does not render shared FAQ on market landing pages", async () => {
      await renderPage("abs-flood-barriers");

      expect(screen.queryByTestId("faq-section")).not.toBeInTheDocument();
    });

    it("adds Product and BreadcrumbList JSON-LD through the shared graph script", async () => {
      await renderPage("abs-flood-barriers");

      const graphCall = mockJsonLdGraphScript.mock.calls.at(-1)?.[0] as
        | { readonly locale: string; readonly data: readonly unknown[] }
        | undefined;

      expect(graphCall?.locale).toBe("en");
      expect(graphCall?.data).toEqual([
        expect.objectContaining({ "@type": "Product" }),
        expect.objectContaining({ "@type": "BreadcrumbList" }),
        expect.objectContaining({ "@type": "FAQPage" }),
      ]);
      const productNode = graphCall?.data.find(
        (item) =>
          item !== null &&
          typeof item === "object" &&
          (item as { "@type"?: unknown })["@type"] === "Product",
      );
      const jsonLdPayload = JSON.stringify(graphCall?.data);

      expect(productNode).toMatchObject({
        name: "ABS Interlocking Boxwall Flood Barriers",
        description: expect.stringContaining(
          "A freestanding flood barrier that needs no bolts",
        ),
      });
      expect(jsonLdPayload).not.toContain("ProductGroup");
      expect(jsonLdPayload).not.toContain("hasVariant");
      expect(jsonLdPayload).not.toMatch(/placeholder/iu);
      expect(jsonLdPayload).not.toContain("brandAssets");
      expect(jsonLdPayload).not.toContain(
        "Straight, curved and gable-end ABS units for freestanding runs.",
      );
    });

    it("emits JSON-LD image only for safe root-relative real product images", async () => {
      await expect(
        buildAbsProductSchemaForImage({
          status: "real",
          src: "/images/tucsenberg-logo.png",
        }),
      ).resolves.toMatchObject({
        image: "https://www.example.com/images/tucsenberg-logo.png",
      });

      await expect(
        buildAbsProductSchemaForImage({
          status: "real",
          src: "//evil.example/product.png",
        }),
      ).resolves.not.toHaveProperty("image");

      await expect(
        buildAbsProductSchemaForImage({
          status: "real",
          src: "/../package.json",
        }),
      ).resolves.not.toHaveProperty("image");
    });
  });

  describe("metadata", () => {
    it("uses central path-aware metadata with x-default alternates", async () => {
      const metadata = await generatePageMetadata("abs-flood-barriers");

      expect(metadata).toMatchObject({
        title: "ABS Interlocking Flood Barriers — Freestanding Boxwall",
        description:
          "Freestanding ABS interlocking flood barriers, factory-direct from China. 50–85 cm heights; straight, curve and gable-end units. Reply within 12 hours.",
        alternates: {
          canonical: "https://www.example.com/products/abs-flood-barriers",
          languages: {
            en: "https://www.example.com/products/abs-flood-barriers",
            "x-default": "https://www.example.com/products/abs-flood-barriers",
          },
        },
      });
    });

    it("keeps product URLs canonical when SITE_CONFIG.baseUrl has a trailing slash", async () => {
      const expectedUrl = "https://www.example.com/products/abs-flood-barriers";
      mockPathsConfig.SITE_CONFIG.baseUrl = "https://www.example.com/";

      const metadata = await generatePageMetadata("abs-flood-barriers");
      await renderPage("abs-flood-barriers");

      const graphCall = mockJsonLdGraphScript.mock.calls.at(-1)?.[0] as
        { readonly data: readonly unknown[] } | undefined;
      const productNode = findProductSchemaNode(graphCall?.data ?? []);

      expect(metadata.alternates?.canonical).toBe(expectedUrl);
      expect(productNode.url).toBe(expectedUrl);
      expect(productNode.url).toBe(metadata.alternates?.canonical);
      expect(String(productNode.url)).not.toContain("//products");
      expect(String(metadata.alternates?.canonical)).not.toContain(
        "//products",
      );
    });
  });

  describe("Scenario 1.2: Product content sections rendered", () => {
    it("renders current Tucsenberg product sections", async () => {
      await renderPage("abs-flood-barriers");

      expect(
        screen.getByRole("heading", { name: "How it works" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Specifications" }),
      ).toBeInTheDocument();
      expect(screen.getByText("TB-BW50")).toBeInTheDocument();
    });

    it("does not render the retired sticky family nav", async () => {
      await renderPage("abs-flood-barriers");
      expect(screen.queryByTestId("sticky-nav")).not.toBeInTheDocument();
    });
  });

  describe("Scenario 1.6: Trust signals are present", () => {
    it("renders product specification tables from the Tucsenberg page copy", async () => {
      await renderPage("abs-flood-barriers");

      const specificationsSection = screen
        .getByRole("heading", { name: "Specifications" })
        .closest("section");
      expect(specificationsSection).not.toBeNull();

      expect(
        within(specificationsSection as HTMLElement).getByText(
          "Wall thickness",
        ),
      ).toBeInTheDocument();
      expect(
        within(specificationsSection as HTMLElement).getByText("4 mm"),
      ).toBeInTheDocument();
    });

    it("renders buyer guidance sections from the Tucsenberg page copy", async () => {
      await renderPage("abs-flood-barriers");

      expect(
        screen.getByRole("heading", {
          name: "Small orders, samples, first-time buyers",
        }),
      ).toBeInTheDocument();
    });

    it("renders a second current product line", async () => {
      await renderPage("aluminum-flood-gates");

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "Aluminum Flood Gates",
      );
      expect(screen.getByText("6063-T6")).toBeInTheDocument();
    });
  });

  describe("Scenario 1.7: CTA links to /request-quote", () => {
    it("renders CTA section with the validated catalog query contract", async () => {
      await renderPage("abs-flood-barriers");

      const ctaLink = screen.getAllByRole("link", {
        name: /request a quote/i,
      })[0];
      expect(ctaLink).toHaveAttribute(
        "href",
        "/request-quote?catalogProductId=abs-flood-barriers",
      );
    });

    it("renders the spec-sheet download link without gating", async () => {
      await renderPage("abs-flood-barriers");

      expect(
        screen.getByRole("link", { name: "Download spec sheet" }),
      ).toHaveAttribute("href", "/downloads/spec-sheet-tb-bw.pdf");
    });

    it("links to the specifications guide from the ABS specifications section", async () => {
      await renderPage("abs-flood-barriers");

      const specificationsSection = screen
        .getByRole("heading", { name: "Specifications" })
        .closest("section");
      expect(specificationsSection).not.toBeNull();

      const guideLink = within(specificationsSection as HTMLElement).getByRole(
        "link",
        {
          name: /Demountable flood barrier specifications explained/i,
        },
      );
      expect(guideLink).toHaveAttribute(
        "href",
        "/guides/flood-barrier-specifications",
      );
    });

    it("renders the final CTA heading", async () => {
      await renderPage("abs-flood-barriers");

      expect(
        screen.getByRole("heading", { name: "Request a quote" }),
      ).toBeInTheDocument();
    });
  });

  describe("Scenario: Product market FAQ is mounted from product copy", () => {
    it("renders FAQ questions as h3 headings", async () => {
      await renderPage("abs-flood-barriers");

      expect(
        screen.getByRole("heading", {
          level: 3,
          name: /Can one person deploy it/i,
        }),
      ).toBeInTheDocument();
    });
  });

  describe("Scenario 1.10: Invalid market slug calls notFound", () => {
    it("calls notFound for invalid market slug", async () => {
      await expect(renderPage("invalid-market")).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
      expect(mockNotFound).toHaveBeenCalled();
    });
  });

  describe("Breadcrumb", () => {
    it("renders breadcrumb navigation", async () => {
      await renderPage("abs-flood-barriers");
      expect(screen.getByLabelText("breadcrumb")).toBeInTheDocument();
    });

    it("opts product detail breadcrumb route links out of automatic prefetch", async () => {
      await renderPage("abs-flood-barriers");

      expect(mockCatalogBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          homePrefetch: false,
          market: expect.objectContaining({ slug: "abs-flood-barriers" }),
          marketLabel: "ABS Interlocking Boxwall Flood Barriers",
          productsPrefetch: false,
          renderJsonLd: false,
        }),
        undefined,
      );
    });
  });

  describe("Scenario: Another product line renders with product copy", () => {
    it("renders current product page copy for flood tube dams", async () => {
      await renderPage("flood-tube-dams");

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "Water & Air-Filled Flood Tube Dams",
      );
      expect(screen.getByText("TB-TD series")).toBeInTheDocument();
    });

    it("renders trust/spec content for flood tube dams", async () => {
      await renderPage("flood-tube-dams");

      expect(
        screen.getByText("0.9 mm PVC tarpaulin, thermally moulded"),
      ).toBeInTheDocument();
    });
  });
});
