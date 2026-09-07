import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import ts from "typescript";

const SOURCE_FILES = [
  "src/app/api/inquiry/route.ts",
  "src/app/api/health/route.ts",
  "src/app/[locale]/contact/page.tsx",
  "src/app/[locale]/contact/contact-page-data.ts",
] as const;

const RUNTIME_CACHE_CALLS = new Set([
  "cacheLife",
  "cacheTag",
  "revalidatePath",
  "revalidateTag",
  "updateTag",
]);

function hasRuntimeCacheUsage(source: string): boolean {
  const sourceFile = ts.createSourceFile(
    "cache-boundary.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let found = false;

  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === "next/cache"
    ) {
      found = true;
      return;
    }

    if (ts.isCallExpression(node)) {
      const [firstArgument] = node.arguments;
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        firstArgument &&
        ts.isStringLiteral(firstArgument) &&
        firstArgument.text === "next/cache"
      ) {
        found = true;
        return;
      }

      const callName = ts.isIdentifier(node.expression)
        ? node.expression.text
        : ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : undefined;
      if (callName && RUNTIME_CACHE_CALLS.has(callName)) {
        found = true;
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

describe("cache directive policy", () => {
  it("keeps critical routes and contact content free of use-cache directives", () => {
    for (const filePath of SOURCE_FILES) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- 测试只读取上方固定的仓库文件
      const source = readFileSync(filePath, "utf8");

      expect(source, filePath).not.toMatch(/["']use\s+cache["']/iu);
      expect(hasRuntimeCacheUsage(source), filePath).toBe(false);
    }
  });

  it.each([
    'import { revalidatePath } from "next/cache";',
    'const { revalidatePath } = await import("next/cache");',
    'cacheTag("inquiry");',
    'cache.revalidateTag("inquiry");',
  ])("detects forbidden runtime cache usage: %s", (source) => {
    expect(hasRuntimeCacheUsage(source)).toBe(true);
  });
});
