import { describe, expect, it } from "vitest";
import { PUBLIC_STATIC_PAGE_DEFINITIONS } from "@/config/pages.config";
import { SITE_PAGE_CASES } from "../../e2e/site-page-cases";

describe("site smoke route contract", () => {
  it("visits every core public route once", () => {
    const expected = PUBLIC_STATIC_PAGE_DEFINITIONS.map(({ path }) => path);
    const actual = SITE_PAGE_CASES.map(([path]) => path);

    expect([...actual].sort()).toEqual([...expected].sort());
    expect(new Set(actual).size).toBe(actual.length);
  });
});
