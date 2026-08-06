import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPageBySlug } from "../queries";

const { mockResolveOptionalContentEntry } = vi.hoisted(() => ({
  mockResolveOptionalContentEntry: vi.fn(),
}));

vi.mock("@/lib/content-manifest", () => ({
  resolveOptionalContentEntry: mockResolveOptionalContentEntry,
}));

describe("content-query manifest runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads pages directly from the generated content manifest", async () => {
    mockResolveOptionalContentEntry.mockReturnValue({
      type: "pages",
      locale: "en",
      slug: "about",
      extension: ".mdx",
      filePath: "/content/pages/en/about.mdx",
      relativePath: "content/pages/en/about.mdx",
      metadata: {
        title: "About",
        description: "About page",
        slug: "about",
        publishedAt: "2026-01-01",
        updatedAt: "2026-01-02",
      },
      content: "## About",
    });

    const page = await getPageBySlug("about", "en");

    expect(mockResolveOptionalContentEntry).toHaveBeenCalledWith("en", "about");
    expect(page).toEqual({
      slug: "about",
      metadata: {
        title: "About",
        description: "About page",
        slug: "about",
        publishedAt: "2026-01-01",
        updatedAt: "2026-01-02",
      },
      content: "## About",
      filePath: "/content/pages/en/about.mdx",
    });
  });

  it("throws the existing content-not-found message when a manifest entry is missing", async () => {
    mockResolveOptionalContentEntry.mockReturnValue(undefined);

    await expect(getPageBySlug("missing", "en")).rejects.toThrow(
      "Content not found: missing",
    );
  });
});
