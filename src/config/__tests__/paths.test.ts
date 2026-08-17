import { describe, expect, it } from "vitest";
import {
  getCanonicalPath,
  getLocalizedPath,
  getPageTypeFromPath,
  getPathnames,
  LOCALES_CONFIG,
  PATHS_CONFIG,
} from "@/config/paths";

const CORE_PATHS = {
  home: "/",
  products: "/products",
  about: "/about",
  requestQuote: "/request-quote",
  contact: "/contact",
  privacy: "/privacy",
  terms: "/terms",
} as const;

describe("paths", () => {
  it("keeps the single-locale route contract", () => {
    expect(LOCALES_CONFIG).toMatchObject({
      locales: ["en"],
      defaultLocale: "en",
      localePrefix: "never",
    });
  });

  it("maps every core page to its canonical path", () => {
    expect(Object.keys(PATHS_CONFIG)).toEqual(Object.keys(CORE_PATHS));
    for (const [pageType, path] of Object.entries(CORE_PATHS)) {
      expect(getCanonicalPath(pageType as keyof typeof CORE_PATHS)).toBe(path);
      expect(getLocalizedPath(pageType as keyof typeof CORE_PATHS, "en")).toBe(
        path,
      );
      expect(getPageTypeFromPath(path, "en")).toBe(pageType);
    }
  });

  it("publishes only shared static pathnames", () => {
    const expected = Object.fromEntries(
      Object.values(CORE_PATHS).map((path) => [path, path]),
    );
    expect(getPathnames()).toEqual(expected);
  });

  it("returns null for an unknown path", () => {
    expect(getPageTypeFromPath("/unknown", "en")).toBeNull();
  });
});
