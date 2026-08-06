import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("static route truth boundary", () => {
  it("keeps single-site navigation hrefs derived from route helpers", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/config/single-site.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /\bhref:\s*["'`](?:\/|\/about|\/contact|\/products|\/privacy|\/terms|\/custom-project-support)["'`]/,
    );
  });

  it("keeps active product SEO emitters free of hand-written product route literals", () => {
    const files = [
      "src/app/[locale]/products/[market]/page.tsx",
      "src/components/products/catalog-breadcrumb.tsx",
    ];

    for (const file of files) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads fixed repo-local files from the allowlist above.
      const source = readFileSync(path.resolve(process.cwd(), file), "utf8");

      expect(source, file).not.toMatch(/["'`]\s*\/products(?:\/|\?|["'`])/);
    }
  });
});
