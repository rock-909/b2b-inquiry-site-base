import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderAsyncPage } from "@/test/render-async-page";

const { mockLoadLegalPage } = vi.hoisted(() => ({
  mockLoadLegalPage: vi.fn(),
}));

vi.mock("@/lib/content/legal-page", () => ({
  loadLegalPage: mockLoadLegalPage,
}));

vi.mock("@/components/content/legal-page-shell", () => ({
  LegalPageShell: vi.fn(() =>
    React.createElement("main", { "data-testid": "legal-shell" }, "Terms"),
  ),
}));

vi.mock("@/lib/seo-metadata", () => ({
  generateMetadataForPath: vi.fn(() => ({
    title: "Terms of Service",
    description: "Terms description",
  })),
}));

// next-intl/server (incl. setRequestLocale) is mocked globally in
// src/test/setup.constants-and-i18n.ts; no local override needed here.

describe("TermsContent async invocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockLoadLegalPage.mockResolvedValue({
      content: "## Introduction {#introduction}\nWelcome.",
      headings: [{ level: 2, text: "Introduction", id: "introduction" }],
      metadata: {
        slug: "terms",
        title: "Terms of Service",
        publishedAt: "2024-01-01",
        updatedAt: "2024-06-01",
        layout: "legal",
        showToc: true,
        lastReviewed: "2024-06-01",
      },
    });
  });

  it("should load terms legal page with await in TermsContent", async () => {
    const { default: TermsPage } = await import("@/app/[locale]/terms/page");

    const pageElement = await TermsPage({
      params: Promise.resolve({ locale: "en" }),
    });

    await renderAsyncPage(pageElement);

    expect(mockLoadLegalPage).toHaveBeenCalledWith("terms", "en");
  });
});
