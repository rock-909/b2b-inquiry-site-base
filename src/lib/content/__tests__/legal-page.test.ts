import { describe, expect, it, vi } from "vitest";

const mockGetStaticPage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/static-pages", () => ({
  getStaticPage: mockGetStaticPage,
}));

import { loadLegalPage } from "../legal-page";

describe("loadLegalPage headings", () => {
  function headingsFor(content: string) {
    mockGetStaticPage.mockReturnValueOnce({
      metadata: { title: "Privacy", slug: "privacy", publishedAt: "2024-01-01" },
      content,
      slug: "privacy",
    });
    return loadLegalPage("privacy", "en").headings;
  }

  it("extracts H2 and H3 headings with slugified IDs", () => {
    const content =
      "## Introduction\n\nText.\n\n## Information We Collect\n\n### Personal Data\n\nMore text.";
    const headings = headingsFor(content);

    expect(headings).toEqual([
      { level: 2, text: "Introduction", id: "introduction" },
      {
        level: 2,
        text: "Information We Collect",
        id: "information-we-collect",
      },
      { level: 3, text: "Personal Data", id: "personal-data" },
    ]);
  });

  it("uses explicit anchor ID when present via {#id} syntax", () => {
    const content =
      "## Introduction {#intro}\n\n## How We Use Your Data {#data-use}\n\n### Cookies {#cookies-policy}";
    const headings = headingsFor(content);

    expect(headings).toEqual([
      { level: 2, text: "Introduction", id: "intro" },
      { level: 2, text: "How We Use Your Data", id: "data-use" },
      { level: 3, text: "Cookies", id: "cookies-policy" },
    ]);
  });

  it("returns empty array for content with no headings", () => {
    expect(headingsFor("Just a paragraph.")).toEqual([]);
  });
});
