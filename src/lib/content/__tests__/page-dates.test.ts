import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCanonicalPath } from "@/config/paths/utils";
import {
  SINGLE_SITE_PUBLIC_STATIC_PAGE_ROUTES,
  SINGLE_SITE_PUBLIC_STATIC_PAGES,
} from "@/config/single-site-seo";
import {
  getMdxPageLastModified,
  isMdxDrivenPage,
} from "@/lib/content/page-dates";
import { CONTENT_MANIFEST } from "@/lib/content-manifest.generated";

const { mockGetContentEntry, mockLoggerWarn } = vi.hoisted(() => ({
  mockGetContentEntry: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

vi.mock("@/lib/content-manifest", () => ({
  resolveOptionalContentEntry: mockGetContentEntry,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: mockLoggerWarn,
  },
}));

describe("page-dates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps sitemap MDX page detection aligned with public static routes", () => {
    const nonMdxPages = new Set([
      "",
      getCanonicalPath("products"),
      getCanonicalPath("requestQuote"),
    ]);
    const representativePageContracts = [
      { path: "", isMdx: false },
      { path: "/about", isMdx: true },
      { path: "/oem-wholesale", isMdx: true },
      { path: "/guides/flood-barrier-materials-guide", isMdx: true },
      { path: "/guides/flood-barrier-specifications", isMdx: true },
      { path: "/request-quote", isMdx: false },
      { path: "/contact", isMdx: true },
      { path: "/warranty", isMdx: true },
      { path: "/privacy", isMdx: true },
      { path: "/terms", isMdx: true },
      { path: "/products", isMdx: false },
    ] as const;

    for (const pagePath of SINGLE_SITE_PUBLIC_STATIC_PAGES) {
      expect(isMdxDrivenPage(pagePath)).toBe(!nonMdxPages.has(pagePath));
    }

    for (const { path, isMdx } of representativePageContracts) {
      expect(isMdxDrivenPage(path)).toBe(isMdx);
    }

    expect(SINGLE_SITE_PUBLIC_STATIC_PAGE_ROUTES).toEqual([
      "home",
      "products",
      "oemWholesale",
      "materialsGuide",
      "specificationsGuide",
      "about",
      "requestQuote",
      "contact",
      "warranty",
      "privacy",
      "terms",
    ]);
  });

  it("loads MDX updatedAt from the en-only route-derived content", async () => {
    mockGetContentEntry.mockImplementation(
      (locale: string, slug: string) => ({
        type: "pages",
        locale,
        slug,
        extension: ".mdx",
        filePath: `/content/pages/${locale}/${slug}.mdx`,
        relativePath: `content/pages/${locale}/${slug}.mdx`,
        metadata: {
          publishedAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-04-01T00:00:00Z",
        },
        content: "",
      }),
    );

    const lastModified = await getMdxPageLastModified(
      getCanonicalPath("about"),
    );

    expect(lastModified).toEqual(new Date("2026-04-01T00:00:00Z"));
    expect(mockGetContentEntry).toHaveBeenCalledWith("en", "about");
    expect(mockGetContentEntry).not.toHaveBeenCalledWith("zh", "about");
  });

  it("rejects paths that are not mapped from a static route id", async () => {
    await expect(getMdxPageLastModified("/unknown")).rejects.toThrow(
      "No MDX slug mapping for path: /unknown",
    );
  });

  it("keeps legal page frontmatter dates present for en-only content", () => {
    const legalFiles = [
      "content/pages/en/privacy.mdx",
      "content/pages/en/terms.mdx",
      "content/pages/en/warranty.mdx",
    ];

    for (const filePath of legalFiles) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test iterates fixed legal MDX fixture paths
      const source = readFileSync(filePath, "utf8");
      const updatedAt = source.match(/updatedAt: ['"]([^'"]+)['"]/u)?.[1];

      expect(updatedAt, filePath).toBeTruthy();
    }
  });

  it("keeps generated legal page metadata aligned with en-only content", () => {
    const legalPages = [
      { locale: "en", slug: "privacy" },
      { locale: "en", slug: "terms" },
      { locale: "en", slug: "warranty" },
    ] as const;

    for (const { locale, slug } of legalPages) {
      const entry = CONTENT_MANIFEST.byKey[`pages/${locale}/${slug}`];
      const updatedAt = entry?.metadata.updatedAt;

      expect(entry, `${locale}/${slug}`).toBeDefined();
      expect(updatedAt, `${locale}/${slug}`).toEqual(expect.any(String));
    }
  });
});
