import { describe, expect, it } from "vitest";
import {
  getCanonicalPath,
  getLocalizedPath,
  LOCALES_CONFIG,
  PATHNAMES,
  PATHS_CONFIG,
} from "@/config/paths";

const CORE_PATHS = {
  home: "/",
  products: "/products",
  about: "/about",
  contact: "/contact",
  privacy: "/privacy",
  terms: "/terms",
} as const;

describe("paths", () => {
  it("keeps the configured locale route contract", () => {
    expect(LOCALES_CONFIG).toMatchObject({
      locales: ["en", "es"],
      defaultLocale: "en",
      localePrefix: "as-needed",
    });
  });

  it("maps every core page to its canonical path", () => {
    expect(Object.keys(PATHS_CONFIG)).toEqual(Object.keys(CORE_PATHS));
    for (const [pageType, path] of Object.entries(CORE_PATHS)) {
      expect(getCanonicalPath(pageType as keyof typeof CORE_PATHS)).toBe(path);
      expect(getLocalizedPath(pageType as keyof typeof CORE_PATHS, "en")).toBe(
        path,
      );
    }
  });

  it("publishes only shared static pathnames", () => {
    const expected = Object.fromEntries(
      Object.values(CORE_PATHS).map((path) => [path, path]),
    );
    expect(PATHNAMES).toEqual(expected);
  });

  it("builds and resolves the Spanish locale prefix", () => {
    expect(getLocalizedPath("about", "es")).toBe("/es/about");
  });
});
