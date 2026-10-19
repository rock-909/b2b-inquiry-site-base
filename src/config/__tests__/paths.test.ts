import { describe, expect, it } from "vitest";
import { PUBLIC_STATIC_PAGE_DEFINITIONS } from "@/config/pages.config";
import {
  getCanonicalPath,
  getLocalePath,
  LOCALES_CONFIG,
  PATHNAMES,
} from "@/config/paths";

const { defaultLocale, locales } = LOCALES_CONFIG;

describe("paths", () => {
  it("keeps a valid locale route contract", () => {
    expect(locales).toContain(defaultLocale);
    expect(new Set(locales).size).toBe(locales.length);
    expect(LOCALES_CONFIG.localePrefix).toBe("as-needed");
  });

  it("registers unique page types and paths", () => {
    const pageTypes = PUBLIC_STATIC_PAGE_DEFINITIONS.map(
      (page) => page.pageType,
    );
    const paths = PUBLIC_STATIC_PAGE_DEFINITIONS.map((page) => page.path);
    expect(new Set(pageTypes).size).toBe(pageTypes.length);
    expect(new Set(paths).size).toBe(paths.length);
    expect(getCanonicalPath("home")).toBe("/");
  });

  it("publishes exactly the registered paths as shared static pathnames", () => {
    expect(PATHNAMES).toEqual(
      Object.fromEntries(
        PUBLIC_STATIC_PAGE_DEFINITIONS.map((page) => [page.path, page.path]),
      ),
    );
  });

  it("prefixes every non-default locale and leaves the default unprefixed", () => {
    for (const { pageType, path } of PUBLIC_STATIC_PAGE_DEFINITIONS) {
      expect(getCanonicalPath(pageType)).toBe(path);
      for (const locale of locales) {
        const prefix = locale === defaultLocale ? "" : `/${locale}`;
        expect(getLocalePath(locale, path)).toBe(
          path === "/" ? prefix || "/" : `${prefix}${path}`,
        );
      }
    }
  });
});
