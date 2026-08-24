import { describe, expect, it } from "vitest";
import type { PageType } from "@/config/paths";
import {
  PUBLIC_STATIC_PAGE_DEFINITIONS,
  PUBLIC_STATIC_PAGE_TYPES,
} from "@/config/pages.config";

describe("static public pages architecture contract", () => {
  it("keeps one canonical path on every registered public page", () => {
    expect(
      PUBLIC_STATIC_PAGE_DEFINITIONS.map(({ pageType, path }) => [
        pageType,
        path,
      ]),
    ).toEqual([
      ["home", "/"],
      ["products", "/products"],
      ["about", "/about"],
      ["contact", "/contact"],
      ["privacy", "/privacy"],
      ["terms", "/terms"],
    ]);
  });

  it("keeps the current PageType set represented by the registry", () => {
    const expected = [
      "home",
      "products",
      "about",
      "contact",
      "privacy",
      "terms",
    ] as const satisfies readonly PageType[];

    expect(PUBLIC_STATIC_PAGE_TYPES).toEqual(expected);
  });
});
