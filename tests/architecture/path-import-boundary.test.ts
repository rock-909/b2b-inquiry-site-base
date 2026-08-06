import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = "src/app";
const SOURCE_FILE_PATTERN = /\.(?:ts|tsx)$/;

function walkFiles(root: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-only architecture scan walks the approved app source root
  return readdirSync(root).flatMap((entry) => {
    const fullPath = join(root, entry);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-only architecture scan inspects discovered files under the approved app source root
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      return walkFiles(fullPath);
    }

    return SOURCE_FILE_PATTERN.test(fullPath) ? [fullPath] : [];
  });
}

function toRepoPath(filePath: string): string {
  return relative(process.cwd(), filePath).replaceAll("\\", "/");
}

function isRouteTestFile(filePath: string): boolean {
  return (
    filePath.startsWith("src/app/") &&
    filePath.includes("/__tests__/") &&
    (filePath.endsWith(".test.ts") ||
      filePath.endsWith(".test.tsx") ||
      filePath.endsWith(".spec.ts") ||
      filePath.endsWith(".spec.tsx"))
  );
}

function hasPathSubentryImport(source: string): boolean {
  const compactSource = source
    .replaceAll(" ", "")
    .replaceAll("\n", "")
    .replaceAll("\t", "");

  return (
    compactSource.includes('from"@/config/paths/') ||
    compactSource.includes("from'@/config/paths/") ||
    compactSource.includes('import("@/config/paths/') ||
    compactSource.includes("import('@/config/paths/") ||
    compactSource.includes('require("@/config/paths/') ||
    compactSource.includes("require('@/config/paths/")
  );
}

describe("path import boundary", () => {
  it("keeps app routes on the public paths facade instead of paths subentries", () => {
    const routeFilesWithSubentryImports = walkFiles(APP_ROOT)
      .map(toRepoPath)
      .filter((filePath) => !isRouteTestFile(filePath))
      .filter((filePath) =>
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-only architecture scan reads discovered app source files
        hasPathSubentryImport(readFileSync(filePath, "utf8")),
      );

    expect(routeFilesWithSubentryImports).toEqual([]);
  });

  it("detects static imports, dynamic imports, and require calls to paths subentries", () => {
    expect(
      hasPathSubentryImport('import { x } from "@/config/paths/utils";'),
    ).toBe(true);
    expect(hasPathSubentryImport('await import("@/config/paths/utils");')).toBe(
      true,
    );
    expect(hasPathSubentryImport('require("@/config/paths/utils");')).toBe(
      true,
    );
  });
});
