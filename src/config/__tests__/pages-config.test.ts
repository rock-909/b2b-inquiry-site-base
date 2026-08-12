import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PUBLIC_STATIC_PAGE_DEFINITIONS,
  PUBLIC_STATIC_PAGE_TYPES,
  getMdxPageSlugByStaticPath,
  getStaticPageLastmodByPath,
  getStaticSitemapPages,
} from "@/config/pages.config";

const CORE_PAGE_TYPES = [
  "home",
  "products",
  "about",
  "requestQuote",
  "contact",
  "privacy",
  "terms",
] as const;

describe("pages.config", () => {
  it("registers the catalog index with the core public pages", () => {
    expect(PUBLIC_STATIC_PAGE_TYPES).toEqual(CORE_PAGE_TYPES);
    expect(getStaticSitemapPages()).toEqual([
      "",
      "/products",
      "/about",
      "/request-quote",
      "/contact",
      "/privacy",
      "/terms",
    ]);
  });

  it("keeps every route owner backed by a real page", () => {
    for (const definition of PUBLIC_STATIC_PAGE_DEFINITIONS) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- route owners come from the fixed public page registry under test
      expect(existsSync(definition.routeOwner), definition.routeOwner).toBe(
        true,
      );
    }
  });

  it("keeps MDX and static lastmod ownership explicit", () => {
    expect(getMdxPageSlugByStaticPath()).toEqual({
      "/about": "about",
      "/contact": "contact",
      "/privacy": "privacy",
      "/terms": "terms",
    });
    expect(getStaticPageLastmodByPath()).toEqual({
      "": "2026-07-05T00:00:00Z",
      "/products": "2026-08-12T00:00:00Z",
      "/request-quote": "2026-07-05T00:00:00Z",
    });
  });
});
