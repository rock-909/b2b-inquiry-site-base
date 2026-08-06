import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PATHS_CONFIG, type PageType } from "@/config/paths";
import { resolveOptionalContentEntry } from "@/lib/content-manifest";
import {
  PUBLIC_STATIC_PAGE_DEFINITIONS,
  PUBLIC_STATIC_PAGE_TYPES,
  getMdxPageSlugByStaticPath,
  getPublicStaticPageDefinition,
  getStaticPageDefinitionsByType,
  getStaticPageLastmodByPath,
  getStaticSitemapPageConfigByPath,
  getStaticSitemapPages,
} from "@/config/pages.config";

const EXPECTED_STATIC_PUBLIC_PAGE_TYPES = [
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
] as const satisfies readonly PageType[];

const REPO_ROOT = process.cwd();

function repoFileExists(relativePath: string): boolean {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test checks fixed repo-local route/content paths from the registry contract
  return existsSync(join(REPO_ROOT, relativePath));
}

function toExpectedStaticPath(path: string): string {
  return path === "/" ? "" : path;
}

function expectStaticRouteOwner(routeOwner: string): void {
  expect(routeOwner.startsWith("src/app/[locale]/")).toBe(true);
  expect(routeOwner.endsWith("page.tsx")).toBe(true);

  const relativePath = routeOwner.slice("src/app/[locale]/".length);
  const segments = relativePath.split("/");
  expect(segments.at(-1)).toBe("page.tsx");

  const routeSegments = segments.slice(0, -1);
  const allowedCharacters = "abcdefghijklmnopqrstuvwxyz0123456789-";
  for (const segment of routeSegments) {
    expect(segment.length).toBeGreaterThan(0);
    for (const character of segment) {
      expect(allowedCharacters).toContain(character);
    }
  }
}

describe("pages.config static public page registry", () => {
  it("lists every current static public PageType once", () => {
    expect(PUBLIC_STATIC_PAGE_TYPES).toEqual(EXPECTED_STATIC_PUBLIC_PAGE_TYPES);
    expect(new Set(PUBLIC_STATIC_PAGE_TYPES).size).toBe(
      EXPECTED_STATIC_PUBLIC_PAGE_TYPES.length,
    );
    expect([...PUBLIC_STATIC_PAGE_TYPES].sort()).toEqual(
      Object.keys(PATHS_CONFIG).sort(),
    );
  });

  it("keeps each page definition complete and route-owned", () => {
    for (const definition of PUBLIC_STATIC_PAGE_DEFINITIONS) {
      expect(definition.pageType).toBeTruthy();
      expect(definition.localizedPaths).toHaveProperty("en");
      expect(definition.seoKey).toMatch(/^[a-z][a-zA-Z0-9.:-]*$/);
      expectStaticRouteOwner(definition.routeOwner);
      expect(repoFileExists(definition.routeOwner)).toBe(true);
      expect(definition.sitemap.include).toBe(true);
      expect(definition.sitemap.priority).toBeGreaterThan(0);
      expect(definition.sitemap.priority).toBeLessThanOrEqual(1);
      expect(definition.lastmod.source).toMatch(/^(mdx|static)$/u);
    }
  });

  it("derives a lookup by PageType", () => {
    const definitionsByType = getStaticPageDefinitionsByType();

    for (const pageType of EXPECTED_STATIC_PUBLIC_PAGE_TYPES) {
      expect(definitionsByType[pageType]?.pageType).toBe(pageType);
      expect(getPublicStaticPageDefinition(pageType)?.pageType).toBe(pageType);
    }
  });

  it("derives sitemap pages and route configs from the registry", () => {
    expect(getStaticSitemapPages()).toEqual([
      "",
      "/products",
      "/oem-wholesale",
      "/guides/flood-barrier-materials-guide",
      "/guides/flood-barrier-specifications",
      "/about",
      "/request-quote",
      "/contact",
      "/warranty",
      "/privacy",
      "/terms",
    ]);

    const sitemapConfig = getStaticSitemapPageConfigByPath();

    expect(sitemapConfig[""]).toEqual({
      changeFrequency: "daily",
      priority: 1,
    });
    expect(sitemapConfig["/products"]).toEqual({
      changeFrequency: "weekly",
      priority: 0.9,
    });
    expect(sitemapConfig["/request-quote"]).toEqual({
      changeFrequency: "monthly",
      priority: 0.9,
    });
  });

  it("keeps static sidecar lastmod only for non-MDX static public pages", () => {
    expect(getStaticPageLastmodByPath()).toEqual({
      "": "2026-07-05T00:00:00Z",
      "/products": "2026-07-05T00:00:00Z",
      "/request-quote": "2026-07-05T00:00:00Z",
    });
  });

  it("derives MDX page slugs for content/pages backed routes", () => {
    expect(getMdxPageSlugByStaticPath()).toEqual({
      "/about": "about",
      "/oem-wholesale": "oem-wholesale",
      "/guides/flood-barrier-materials-guide": "flood-barrier-materials-guide",
      "/guides/flood-barrier-specifications": "flood-barrier-specifications",
      "/contact": "contact",
      "/warranty": "warranty",
      "/privacy": "privacy",
      "/terms": "terms",
    });
  });

  it("keeps MDX-backed pages backed by real localized content files only", () => {
    const mdxSlugsByPath = getMdxPageSlugByStaticPath();

    for (const definition of PUBLIC_STATIC_PAGE_DEFINITIONS) {
      const staticPath = toExpectedStaticPath(definition.localizedPaths.en);

      if (definition.mdxCollection === null) {
        expect(
          Object.prototype.hasOwnProperty.call(mdxSlugsByPath, staticPath),
        ).toBe(false);
        continue;
      }

      const slug = definition.mdxCollection.slug;
      expect(mdxSlugsByPath[staticPath]).toBe(slug);
      const enEntry = resolveOptionalContentEntry("en", slug);

      expect(enEntry, `missing en manifest entry for ${slug}`).toBeDefined();
      expect(enEntry?.relativePath).toBe(`content/pages/en/${slug}.mdx`);
    }
  });
});
