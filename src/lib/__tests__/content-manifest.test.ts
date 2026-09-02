import { describe, expect, it } from "vitest";
import { getStaticPage, STATIC_PAGES } from "@/lib/content/static-pages";

describe("static content source", () => {
  it("resolves imported page content", () => {
    expect(getStaticPage("about", "en")).toMatchObject({
      slug: "about",
      filePath: "/src/content/pages/en/about.ts",
    });
  });

  it("resolves the Spanish example page content", () => {
    expect(getStaticPage("about", "es")).toMatchObject({
      slug: "about",
      filePath: "/src/content/pages/es/about.ts",
    });
  });

  it("keeps authored internal links free of locale prefixes", () => {
    for (const [locale, pages] of Object.entries(STATIC_PAGES)) {
      for (const page of Object.values(pages)) {
        expect(page.content).not.toContain(`](/${locale}/`);
        expect(page.content).not.toContain(`](/${locale})`);
      }
    }
  });
});
