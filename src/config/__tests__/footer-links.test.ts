import { describe, expect, it } from "vitest";
import {
  getSingleSiteFooterColumns,
  SINGLE_SITE_FOOTER_COLUMNS,
} from "@/config/single-site";
import { FOOTER_COLUMNS } from "@/config/footer-links";

const EXPECTED_TUCSENBERG_NAVIGATION_LINKS = [
  "home",
  "products",
  "oemWholesale",
  "materialsGuide",
  "specificationsGuide",
  "about",
] as const;

const EXPECTED_TUCSENBERG_SUPPORT_LINKS = [
  "requestQuote",
  "contact",
  "warranty",
  "privacy",
  "terms",
] as const;

describe("footer-links", () => {
  it("exports footer columns with valid structure", () => {
    expect(Array.isArray(FOOTER_COLUMNS)).toBe(true);
    expect(FOOTER_COLUMNS).toBe(SINGLE_SITE_FOOTER_COLUMNS);
    expect(FOOTER_COLUMNS.length).toBeGreaterThan(0);

    for (const column of FOOTER_COLUMNS) {
      expect(typeof column.key).toBe("string");
      expect(column.key.length).toBeGreaterThan(0);
      expect(typeof column.translationKey).toBe("string");
      expect(column.translationKey.length).toBeGreaterThan(0);
      expect(Array.isArray(column.links)).toBe(true);

      for (const link of column.links) {
        expect(typeof link.key).toBe("string");
        expect(link.key.length).toBeGreaterThan(0);
        expect(typeof link.translationKey).toBe("string");
        expect(link.translationKey.length).toBeGreaterThan(0);
        expect(typeof link.href).toBe("string");
        expect(link.href.length).toBeGreaterThan(0);
      }
    }
  });

  it("uses the catalog site footer columns as the singleton source", () => {
    expect(SINGLE_SITE_FOOTER_COLUMNS).toEqual(getSingleSiteFooterColumns());

    const navigationColumn = FOOTER_COLUMNS.find(
      (column) => column.key === "navigation",
    );
    const supportColumn = FOOTER_COLUMNS.find(
      (column) => column.key === "support",
    );

    expect(navigationColumn?.links.map((link) => link.key)).toEqual([
      ...EXPECTED_TUCSENBERG_NAVIGATION_LINKS,
    ]);
    expect(supportColumn?.links.map((link) => link.key)).toEqual([
      ...EXPECTED_TUCSENBERG_SUPPORT_LINKS,
    ]);
  });

  it("can derive the default materialized catalog footer links explicitly", () => {
    const columns = getSingleSiteFooterColumns();
    const navigationColumn = columns.find(
      (column) => column.key === "navigation",
    );
    const supportColumn = columns.find((column) => column.key === "support");

    expect(navigationColumn?.links.map((link) => link.key)).toEqual([
      ...EXPECTED_TUCSENBERG_NAVIGATION_LINKS,
    ]);
    expect(supportColumn?.links.map((link) => link.key)).toEqual([
      ...EXPECTED_TUCSENBERG_SUPPORT_LINKS,
    ]);
  });

  it("links the specifications guide from the active footer navigation column", () => {
    const navigationColumn = FOOTER_COLUMNS.find(
      (column) => column.key === "navigation",
    );
    const specificationsGuideLink = navigationColumn?.links.find(
      (link) => link.key === "specificationsGuide",
    );

    expect(specificationsGuideLink).toEqual(
      expect.objectContaining({
        href: "/guides/flood-barrier-specifications",
        translationKey: "footer.sections.navigation.specificationsGuide",
      }),
    );
  });
});
