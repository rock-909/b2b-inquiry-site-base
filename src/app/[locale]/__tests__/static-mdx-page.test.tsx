import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StaticMdxPage } from "@/app/[locale]/static-mdx-page";
import type { Locale } from "@/types/content.types";

/**
 * 这个共享外壳选哪个 shell、给哪个 schemaType，是所有 MDX 静态页共用的分支。
 * 之前没有单测：`vitest related` 对它报 "No test files found"，pre-commit 的
 * test-related 钩子因为 `--passWithNoTests` 把这条当成通过。钩子改成会红之后，
 * 这里补上它真正的分支证明。
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

vi.mock("@/components/content/trade-landing-shell", () => ({
  TradeLandingShell: ({ pagePath }: { pagePath: string }) => (
    <div data-testid="landing-shell">{pagePath}</div>
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
  pageType: "terms" | "oemWholesale";
  slug: string;
  shell?: "legal" | "landing";
  schemaType?: "WebPage" | "Article";
}) {
  const element = await StaticMdxPage({
    params: Promise.resolve({ locale: "en" as Locale }),
    config,
  });

  render(element);
}

describe("StaticMdxPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadLegalPage.mockResolvedValue(legalPage);
  });

  it("renders the legal shell by default", async () => {
    await renderPage({ pageType: "terms", slug: "terms" });

    expect(screen.getByTestId("legal-shell")).toBeInTheDocument();
    expect(screen.queryByTestId("landing-shell")).not.toBeInTheDocument();
  });

  it("renders the landing shell when the config asks for it", async () => {
    await renderPage({
      pageType: "oemWholesale",
      slug: "oem-wholesale",
      shell: "landing",
    });

    expect(screen.getByTestId("landing-shell")).toBeInTheDocument();
    expect(screen.queryByTestId("legal-shell")).not.toBeInTheDocument();
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
