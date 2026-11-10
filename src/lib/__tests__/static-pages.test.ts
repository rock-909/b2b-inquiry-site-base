import { describe, expect, it } from "vitest";
import { STATIC_PAGES } from "@/lib/content/static-pages";

describe("static content source", () => {
  it("keeps authored internal links free of locale prefixes", () => {
    for (const [locale, pages] of Object.entries(STATIC_PAGES)) {
      for (const page of Object.values(pages)) {
        expect(page.content).not.toContain(`](/${locale}/`);
        expect(page.content).not.toContain(`](/${locale})`);
      }
    }
  });
});
