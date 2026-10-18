import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { PUBLIC_STATIC_PAGE_DEFINITIONS } from "@/config/pages.config";
import { getLocalePath, LOCALES_CONFIG } from "@/config/paths";

describe("sitemap", () => {
  it("publishes each indexable page in every locale once", async () => {
    const entries = await sitemap();
    const paths = entries.map((entry) => new URL(entry.url).pathname);
    const pages = PUBLIC_STATIC_PAGE_DEFINITIONS.filter(
      (page) => page.sitemap.include,
    );
    expect(pages.length).toBeGreaterThan(0);
    expect(paths).toEqual(
      LOCALES_CONFIG.locales.flatMap((locale) =>
        pages.map((page) => getLocalePath(locale, page.path)),
      ),
    );
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain("/contact");
    expect(paths).toContain("/es/contact");
    expect(paths).not.toContain("/products/sample-offering");
    expect(paths).not.toContain("/about");
    for (const path of ["/privacy", "/terms", "/es/privacy", "/es/terms"])
      expect(paths).not.toContain(path);
  });

  it("publishes reciprocal alternates and only supported content dates", async () => {
    const entries = await sitemap();
    for (const entry of entries) {
      expect(entry.priority).toBeGreaterThan(0);
      for (const locale of LOCALES_CONFIG.locales) {
        expect(entry.alternates?.languages).toHaveProperty(locale);
      }
      expect(entry.alternates?.languages).toHaveProperty("x-default");
      const path =
        new URL(entry.url).pathname.replace(/^\/es(?=\/|$)/u, "") || "/";
      if (path === "/") expect(entry).not.toHaveProperty("lastModified");
      else expect(entry.lastModified).toBeInstanceOf(Date);
    }
  });
});
