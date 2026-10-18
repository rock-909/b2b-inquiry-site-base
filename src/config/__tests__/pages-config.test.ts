import { describe, expect, it } from "vitest";
import {
  PUBLIC_STATIC_PAGE_TYPES,
  getStaticContentPageSlugByPath,
  getStaticSitemapPages,
} from "@/config/pages.config";

const CORE_PAGE_TYPES = ["home", "contact", "privacy", "terms"] as const;

describe("pages.config", () => {
  it("registers the core public pages", () => {
    expect(PUBLIC_STATIC_PAGE_TYPES).toEqual(CORE_PAGE_TYPES);
    expect(getStaticSitemapPages()).toEqual(["", "/contact"]);
  });

  it("keeps static content ownership explicit", () => {
    expect(getStaticContentPageSlugByPath()).toEqual({
      "/contact": "contact",
      "/privacy": "privacy",
      "/terms": "terms",
    });
  });
});
