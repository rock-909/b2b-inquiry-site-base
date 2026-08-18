import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StaticContentPage } from "@/app/[locale]/static-content-page";
import type { Locale } from "@/types/content.types";

/**
 * 共享静态内容页在这里选择页面 shell 和 schemaType。
 */

const { mockLoadLegalPage } = vi.hoisted(() => ({
  mockLoadLegalPage: vi.fn(),
}));

vi.mock("@/lib/content/legal-page", () => ({
  loadLegalPage: mockLoadLegalPage,
}));

vi.mock("@/components/content/legal-page-shell", () => ({
  LegalPageShell: ({
    schemaType,
    pagePath,
  }: {
    schemaType: string;
    pagePath: string;
  }) => (
    <div data-testid="legal-shell" data-schema-type={schemaType}>
      {pagePath}
    </div>
  ),
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
}));

const legalPage = {
  metadata: { title: "Terms" },
  content: "<p>body</p>",
  headings: [{ id: "a", text: "A" }],
};

async function renderPage(config: {
  pageType: "terms";
  slug: string;
  schemaType?: "WebPage" | "Article";
}) {
  const element = await StaticContentPage({
    params: Promise.resolve({ locale: "en" as Locale }),
    config,
  });

  render(element);
}

describe("StaticContentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadLegalPage.mockResolvedValue(legalPage);
  });

  it("renders the legal shell by default", async () => {
    await renderPage({ pageType: "terms", slug: "terms" });

    expect(screen.getByTestId("legal-shell")).toBeInTheDocument();
  });

  it("defaults the structured-data type to WebPage", async () => {
    await renderPage({ pageType: "terms", slug: "terms" });

    expect(screen.getByTestId("legal-shell")).toHaveAttribute(
      "data-schema-type",
      "WebPage",
    );
  });

  it("honours a structured-data type override", async () => {
    await renderPage({
      pageType: "terms",
      slug: "terms",
      schemaType: "Article",
    });

    expect(screen.getByTestId("legal-shell")).toHaveAttribute(
      "data-schema-type",
      "Article",
    );
  });

  it("passes the localized path of the configured page type", async () => {
    await renderPage({ pageType: "terms", slug: "terms" });

    expect(screen.getByTestId("legal-shell")).toHaveTextContent("/terms");
  });
});
