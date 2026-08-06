import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function productionSourceFiles(): string[] {
  const entries = readdirSync("src", {
    recursive: true,
    encoding: "utf8",
  }) as string[];
  return entries
    .filter((entry) => /\.tsx?$/.test(entry) && !entry.includes("__tests__"))
    .map((entry) => join("src", entry));
}

function readSource(file: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-only architecture scan reads discovered repo src files
  return readFileSync(file, "utf8");
}

describe("LinkHref lives in its own module, not the retiring route-parsing file", () => {
  it("no production source imports from @/lib/i18n/route-parsing", () => {
    const offenders = productionSourceFiles().filter(
      (file) =>
        !file.endsWith(join("lib", "i18n", "route-parsing.ts")) &&
        readSource(file).includes('from "@/lib/i18n/route-parsing"'),
    );
    expect(offenders).toEqual([]);
  });
});
