import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = "src";
const PAGE_EXPRESSION_IMPORT = "@/config/single-site-page-expression";
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const SKIP_DIRECTORIES = new Set(["__tests__"]);

function listSourceFiles(directory = SOURCE_ROOT): string[] {
  const files: string[] = [];

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test recursively scans the fixed src tree
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRECTORIES.has(entry.name)) {
        files.push(...listSourceFiles(filePath));
      }
      continue;
    }

    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(filePath.replaceAll("\\", "/"));
    }
  }

  return files.sort();
}

function pageExpressionImporters(): string[] {
  return listSourceFiles().filter((filePath) =>
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads source files discovered under src
    readFileSync(filePath, "utf8").includes(PAGE_EXPRESSION_IMPORT),
  );
}

describe("page-expression consumption boundary", () => {
  it("keeps page-expression consumers discoverable instead of allowlisted", () => {
    expect(pageExpressionImporters()).toEqual([
      "src/app/[locale]/page.tsx",
      "src/components/sections/hero-section.tsx",
    ]);
  });

  it("does not silently ignore known page-expression keys", () => {
    for (const filePath of pageExpressionImporters()) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads source files discovered under src
      const source = readFileSync(filePath, "utf8");

      expect(source, filePath).not.toMatch(/default:\s*break;/u);
      expect(source, filePath).not.toMatch(/default:\s*return\s+\[\];/u);
      expect(source, filePath).not.toMatch(/default:\s*return\s+"";/u);
      const defaultClauses = source.match(/default:\s*([^;\n]+);?/gu) ?? [];
      for (const clause of defaultClauses) {
        expect(clause, `${filePath} ${clause}`).toContain("assertNever(");
      }
    }
  });
});
