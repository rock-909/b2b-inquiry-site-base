import { describe, expect, it } from "vitest";
import { getCanonicalPath, type PageType } from "@/config/paths";
import { shouldIndexPublicPage } from "@/config/single-site-seo";

const CORE_PAGE_TYPES = [
  "home",
  "contact",
] as const satisfies readonly PageType[];

describe("public page indexing", () => {
  it("indexes each core page at its canonical path", () => {
    for (const pageType of CORE_PAGE_TYPES) {
      expect(shouldIndexPublicPage(pageType, getCanonicalPath(pageType))).toBe(
        true,
      );
    }
  });

  it("does not index a core page under another path", () => {
    expect(shouldIndexPublicPage("contact", "/products")).toBe(false);
    expect(shouldIndexPublicPage("home", "/contact")).toBe(false);
  });
});
