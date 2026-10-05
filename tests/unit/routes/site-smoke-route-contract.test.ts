import { describe, expect, it } from "vitest";
import { getStaticSitemapPages } from "@/config/pages.config";
import { SITE_PAGE_CASES } from "../../e2e/site-page-cases";

describe("site smoke route contract", () => {
  it("visits every core public route once", () => {
    const expected = getStaticSitemapPages().map((path) => path || "/");
    const actual = SITE_PAGE_CASES.map(([path]) => path);

    expect([...actual].sort()).toEqual([...expected].sort());
    expect(new Set(actual).size).toBe(actual.length);
  });
});
