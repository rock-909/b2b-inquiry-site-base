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

  it("excludes incomplete legal pages", () => {
    expect(shouldIndexPublicPage("privacy", "/privacy")).toBe(false);
    expect(shouldIndexPublicPage("terms", "/terms")).toBe(false);
  });

  it("does not index a core page under another path", () => {
    expect(shouldIndexPublicPage("privacy", "/products")).toBe(false);
  });
});
