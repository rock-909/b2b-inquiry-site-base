/**
 * 约定门:后缀唯一来源是 titleTemplate;渲染级真相由 no-js-html-contract 的 title 断言把守。
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TUCSENBERG_PRODUCT_PAGES } from "@/constants/tucsenberg-product-pages";

const BRAND_SUFFIX = /\|\s*Tucsenberg\s*$/u;

describe("source titles never carry the brand suffix (template owns it)", () => {
  it("product meta titles", () => {
    for (const productPage of Object.values(TUCSENBERG_PRODUCT_PAGES)) {
      expect(productPage.meta.title).not.toMatch(BRAND_SUFFIX);
    }
  });
  it("mdx seo.title frontmatter", () => {
    for (const file of readdirSync("content/pages/en")) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- convention gate iterates fixed content/pages/en fixtures
      const src = readFileSync(`content/pages/en/${file}`, "utf8");
      const m = src.match(/seo:\s*[\s\S]*?title:\s*['"](.+?)['"]/u);
      if (m) expect(m[1], file).not.toMatch(BRAND_SUFFIX);
    }
  });
  it("message metadata titles", () => {
    const pack = JSON.parse(
      readFileSync("messages/profiles/b2b-lead/en/messages.json", "utf8"),
    ) as { requestQuote: { metadata: { title: string } } };
    expect(pack.requestQuote.metadata.title).not.toMatch(BRAND_SUFFIX);
  });
});
