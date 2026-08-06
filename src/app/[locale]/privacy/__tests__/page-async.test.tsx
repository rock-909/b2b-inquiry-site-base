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
    React.createElement("main", { "data-testid": "legal-shell" }, "Privacy"),
  ),
}));

vi.mock("@/lib/seo-metadata", () => ({
  generateMetadataForPath: vi.fn(() => ({
    title: "Privacy Policy",
    description: "Privacy description",
  })),
}));

// next-intl/server (incl. setRequestLocale) is mocked globally in
// src/test/setup.constants-and-i18n.ts; no local override needed here.

describe("PrivacyContent async invocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadLegalPage.mockResolvedValue({
      content:
        "## Information We Collect {#info-collect}\nWe collect data.\n## How We Use {#how-we-use}\nWe use data.",
      headings: [
        { level: 2, text: "Information We Collect", id: "info-collect" },
        { level: 2, text: "How We Use", id: "how-we-use" },
      ],
      metadata: {
        slug: "privacy",
        title: "Privacy Policy",
        publishedAt: "2024-01-01",
        updatedAt: "2024-02-01",
        layout: "legal",
        showToc: true,
        lastReviewed: "2024-02-01",
      },
    });
  });

  it("should load privacy legal page with await in PrivacyContent", async () => {
    const { default: PrivacyPage } =
      await import("@/app/[locale]/privacy/page");

    const pageElement = await PrivacyPage({
      params: Promise.resolve({ locale: "en" }),
    });

    await renderAsyncPage(pageElement);

    expect(mockLoadLegalPage).toHaveBeenCalledWith("privacy", "en");
  });
});
