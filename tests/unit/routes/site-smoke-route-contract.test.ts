import { describe, expect, it } from "vitest";
import { getSingleSitePublicStaticPages } from "@/config/single-site-seo";
import { TUCSENBERG_PRODUCT_PAGES } from "@/constants/tucsenberg-product-pages";
import { SITE_PAGE_CASES } from "../../e2e/site-page-cases";

/**
 * The smoke run is the only lane that loads every public page in a browser.
 * Its route list was hand-written with nothing tying it to the page registry,
 * so shipping a new page left it untested and the run still went green — an
 * absence of coverage reading as coverage.
 *
 * Same shape as `lighthouse-route-contract.test.ts`, which already closes this
 * hole for the measurement lane.
 */
const registryPaths = [
  ...getSingleSitePublicStaticPages().map((path) => path || "/"),
  ...Object.keys(TUCSENBERG_PRODUCT_PAGES).map((slug) => `/products/${slug}`),
];

const smokePaths = SITE_PAGE_CASES.map(([path]) => path);

describe("site smoke route contract", () => {
  it("visits every canonical public route", () => {
    expect([...smokePaths].sort()).toEqual([...registryPaths].sort());
  });

  it("visits each route once", () => {
    expect(new Set(smokePaths).size).toBe(smokePaths.length);
  });

  // A heading that another page would also satisfy proves the page returned 200
  // and nothing else — serve /about at `/` and the smoke run still goes green.
  // The first version of this test used `source.length > 3` as the proxy for
  // "specific"; length proves nothing, so it is the pattern's reach that gets
  // checked here instead.
  //
  // Comparing against the other entries' `source` is only sound while every
  // pattern is the literal heading, hence the first assertion. A pattern that
  // needs regex syntax has to prove its own reach some other way.
  it("checks a heading no other page in the list would satisfy", () => {
    for (const [path, heading] of SITE_PAGE_CASES) {
      expect(heading.source, path).not.toMatch(/[\\^$.*+?()[\]{}|]/u);
      expect(heading.test("Page not found"), path).toBe(false);

      for (const [otherPath, other] of SITE_PAGE_CASES) {
        if (otherPath === path) continue;
        expect(heading.test(other.source), `${path} vs ${otherPath}`).toBe(
          false,
        );
      }
    }
  });
});
