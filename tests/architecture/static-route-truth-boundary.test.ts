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
});
