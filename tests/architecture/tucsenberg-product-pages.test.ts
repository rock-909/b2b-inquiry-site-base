import { existsSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import { getAllMarketSlugs } from "@/constants/product-catalog";
import { TB_BW_HEIGHT_RANGE } from "@/constants/tucsenberg-product-spec-values";
import {
  getTucsenbergProductPage,
  type TucsenbergProductPage,
  TUCSENBERG_PRODUCT_PAGES,
} from "@/constants/tucsenberg-product-pages";

function resolvePublicImagePath(src: string): string {
  const publicRoot = resolve(process.cwd(), "public");
  const resolvedPath = resolve(publicRoot, src.slice(1));

  expect(src).toMatch(/^\/(?!\/)/u);
  expect(src.split(/[?#]/u)[0]?.split("/"), src).not.toContain("..");
  expect(
    resolvedPath === publicRoot ||
      resolvedPath.startsWith(`${publicRoot}${sep}`),
    src,
  ).toBe(true);

  return resolvedPath;
}

// Catalog-count prose only. Quantities that describe a real measurement
// ("five to six bags across a doorway", "4–5 mm") stay legal — the defect is
// copy whose truth depends on how many lines or material classes exist today.
// Matches a count word or digit followed by a catalog noun, so `5 product
// lines` and `five material categories` are caught as well as `five lines`.
const CATALOG_COUNT_WORD = String.raw`\d+|one|two|three|four|five|six|seven|eight|nine|ten`;
// Only catalog qualifiers may sit between the count and the noun. An arbitrary
// gap would swallow unrelated prose such as "3 years on materials", and a bare
// "all <count>" would swallow real groupings such as "all three layers" (the
// perimeter/openings/low-points split, which does not track the line count).
const CATALOG_QUALIFIER = String.raw`product|material|flood\s+barrier`;
const CATALOG_NOUN = String.raw`lines|classes|families|categories|materials|ranges`;
// eslint-disable-next-line security/detect-non-literal-regexp -- composed from the fixed literals above, no external input
const COUNT_BOUND_CATALOG_COPY = new RegExp(
  String.raw`\b(?:${CATALOG_COUNT_WORD})\s+(?:(?:${CATALOG_QUALIFIER})\s+){0,2}(?:${CATALOG_NOUN})\b`,
  "iu",
);

// Every file that authors buyer-facing catalog prose. The product page
// constants belong here too: the first pass only covered the three files the
// finding named, and four sibling files kept the claim alive.
const ACTIVE_CATALOG_COPY_FILES = [
  "messages/profiles/catalog/en/messages.json",
  "content/pages/en/oem-wholesale.mdx",
  "content/pages/en/flood-barrier-materials-guide.mdx",
  ...Object.keys(TUCSENBERG_PRODUCT_PAGES).map(
    (slug) => `src/constants/tucsenberg-product-page-${slug}.ts`,
  ),
];

const PRODUCT_PAGES: Record<string, TucsenbergProductPage> =
  TUCSENBERG_PRODUCT_PAGES;

describe("Tucsenberg catalog copy is not bound to the current line count", () => {
  it("never states how many product lines or material classes exist", () => {
    for (const relativePath of ACTIVE_CATALOG_COPY_FILES) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- derived from the fixed authoring list above
      const copy = readFileSync(join(process.cwd(), relativePath), "utf8");

      expect(copy, relativePath).not.toMatch(COUNT_BOUND_CATALOG_COPY);
    }
  });

  it("catches count-bound phrasings without flagging real measurements", () => {
    for (const offender of [
      "Five product lines, one factory pool",
      "5 product lines, one factory pool",
      "private label across all five lines",
      "compares all 5 classes",
      "an honest comparison of five flood barrier material classes",
      "six product families ship from one pool",
      "five material categories at a glance",
    ]) {
      expect(offender).toMatch(COUNT_BOUND_CATALOG_COPY);
    }

    for (const legitimate of [
      "Two layers across a standard doorway — five to six bags.",
      "3 years on materials and workmanship for standard lines",
      "Most importers juggle three or four Chinese factories",
      "One RFQ covers all three layers; we consolidate across the pool",
      "50–85 cm heights",
      "wall thickness 4–5 mm",
    ]) {
      expect(legitimate).not.toMatch(COUNT_BOUND_CATALOG_COPY);
    }
  });
});

describe("TB-BW height range has one owner", () => {
  it("feeds the product page, its metadata, and its diagram from the same value", () => {
    const page = TUCSENBERG_PRODUCT_PAGES["abs-flood-barriers"];
    const { label, minimumCm, maximumCm } = TB_BW_HEIGHT_RANGE;

    expect(page.proofStrip).toContain(`${label} heights`);
    expect(page.lead).toContain(`Heights from ${minimumCm} to ${maximumCm} cm`);
    expect(page.meta.description).toContain(`${label} heights`);
    expect(page.diagram.kind).toBe("boxwall");
    expect(
      page.diagram.kind === "boxwall" ? page.diagram.labels.heightRange : null,
    ).toBe(label);
  });
});

describe("Tucsenberg product page copy contract", () => {
  it("covers every live product route with owner-approved product page data", () => {
    expect(Object.keys(TUCSENBERG_PRODUCT_PAGES)).toEqual(getAllMarketSlugs());
  });

  it("treats unknown product slugs as missing at runtime and type level", () => {
    const missingProductPage = getTucsenbergProductPage("__missing__");

    expect(missingProductPage).toBeUndefined();
    expectTypeOf(missingProductPage).toEqualTypeOf<
      TucsenbergProductPage | undefined
    >();
  });

  it("keeps each product page RFQ-ready without public price or price offers", () => {
    for (const [slug, page] of Object.entries(PRODUCT_PAGES)) {
      const pagePayload = JSON.stringify(page);

      expect(page.title, slug).toBeTruthy();
      expect(page.lead, slug).toBeTruthy();
      expect(page.cta.label, slug).toMatch(/quote|interest/iu);
      expect(page.sections.length, slug).toBeGreaterThanOrEqual(4);
      expect(page.faqs.length, slug).toBeGreaterThanOrEqual(3);
      expect(page.downloadHref, slug).toMatch(/^\/downloads\/.+\.pdf$/u);
      expect(pagePayload, slug).not.toMatch(/offers"\s*:\s*\{/iu);
      expect(pagePayload, slug).not.toMatch(/price"\s*:/iu);
      expect(pagePayload, slug).not.toMatch(/[$€£]\s*\d/u);
      expect(pagePayload, slug).not.toContain("TODO-OWNER");
    }
  });

  it("uses explicit product image state instead of placeholder paths", () => {
    for (const [slug, page] of Object.entries(PRODUCT_PAGES)) {
      const image = page.image;

      expect(["real", "pending", "omitted"], slug).toContain(image.status);
      expect(JSON.stringify(page), slug).not.toMatch(
        /\/images\/products\/.*placeholder/iu,
      );

      if (image.status === "real") {
        const resolvedPath = resolvePublicImagePath(image.src);

        expect(image.src, slug).not.toContain("placeholder");
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- product image paths are fixed owner-authored constants validated against public/
        expect(existsSync(resolvedPath)).toBe(true);
      }
    }
  });

  it("rejects external-like and escaping real product image paths", () => {
    expect(() =>
      resolvePublicImagePath("//evil.example/product.png"),
    ).toThrow();
    expect(() => resolvePublicImagePath("/../package.json")).toThrow();
  });

  it("uses FAQ questions as display headings and schema source", () => {
    for (const [slug, page] of Object.entries(PRODUCT_PAGES)) {
      for (const faq of page.faqs) {
        expect(faq.question, slug).toMatch(/\?$/u);
        expect(faq.answer, `${slug} ${faq.question}`).not.toContain("TODO");
      }
    }
  });
});
