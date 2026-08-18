import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../../messages/base/en/messages.json";
import ProductsPage, { generateMetadata } from "../page";

const { mockGenerateMetadataForPath, mockJsonLdGraphScript } = vi.hoisted(
  () => ({
    mockGenerateMetadataForPath: vi.fn(() => ({ title: "Products" })),
    mockJsonLdGraphScript: vi.fn(),
  }),
);

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async ({ namespace }: { namespace: string }) => {
    const products =
      namespace === "products.metadata"
        ? messages.products.metadata
        : messages.products;
    return (key: string) => {
      const value = key.split(".").reduce<unknown>((current, segment) => {
        if (typeof current !== "object" || current === null) return undefined;
        return (current as Record<string, unknown>)[segment];
      }, products);
      if (typeof value !== "string")
        throw new Error(`Missing product copy: ${key}`);
      return value;
    };
  }),
}));

vi.mock("@/i18n/routing", () => ({
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

describe("ProductsPage", () => {
  beforeEach(() => {
    mockGenerateMetadataForPath.mockClear();
    mockJsonLdGraphScript.mockClear();
  });

  it("lists the configured sample offering", async () => {
    render(await ProductsPage({ params: Promise.resolve({ locale: "en" }) }));

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: messages.products.page.heading,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: messages.products.page.viewDetails }),
    ).toHaveAttribute("href", "/products/sample-offering");
    expect(screen.getByText("Sample Offering")).toBeInTheDocument();
  });

  it("uses the products page metadata contract", async () => {
    await generateMetadata({ params: Promise.resolve({ locale: "en" }) });

    expect(mockGenerateMetadataForPath).toHaveBeenCalledWith(
      expect.objectContaining({
        pageType: "products",
        path: "/products",
        config: {
          title: messages.products.metadata.title,
          description: messages.products.metadata.description,
        },
      }),
    );
  });
});
