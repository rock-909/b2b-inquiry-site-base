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

// Modules staged for retirement in later PRs must not be a `Locale` source.
const RETIRING_LOCALE_SOURCES = new Set([
  "@/lib/structured-data-types",
  "@/lib/structured-data",
  "@/types/i18n",
]);

// Matches a whole (possibly multiline) import statement up to its `from "..."`.
const IMPORT_STATEMENT = /import[^;]*?from\s*["']([^"']+)["']/g;

function importsLocaleFromRetiringModule(source: string): boolean {
  for (const match of source.matchAll(IMPORT_STATEMENT)) {
    const statement = match[0];
    const sourcePath = match[1];

    if (!sourcePath) {
      continue;
    }

    if (
      RETIRING_LOCALE_SOURCES.has(sourcePath) &&
      /\bLocale\b/.test(statement)
    ) {
      return true;
    }
  }
  return false;
}

describe("Locale is sourced from the canonical i18n module, not retiring ones", () => {
  it("derives the path-layer Locale alias from the canonical locale config", () => {
    const source = readSource("src/config/paths/types.ts");

    expect(source).toContain("ConfiguredLocale as Locale");
  });

  it("no production source imports Locale from a retiring module", () => {
    const offenders = productionSourceFiles().filter((file) =>
      importsLocaleFromRetiringModule(readSource(file)),
    );
    expect(offenders).toEqual([]);
  });
});
