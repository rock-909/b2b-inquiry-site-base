import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../..");

const allowedImportPathPatterns = [
  /\.test\.[cm]?[jt]sx?$/u,
  /\.stories\.[cm]?[jt]sx?$/u,
  /\.fixtures\.[cm]?[jt]sx?$/u,
] as const;

const storyImportPattern = /(?:from|import\()\s*["'][^"']*\.stories["']/u;

// Storybook is an owner-visible review surface; these motifs would push the old
// generic-demo / developer-platform direction back into review.
const bannedStoryMotifPattern = /vercel|geist|developer platform|ai workflow/iu;

const ownerVisibleStoryRoots = [
  "src/components/sections",
  "src/components/footer",
  "src/components/layout",
] as const;

// Pure-Node scan (no external `rg` dependency, which is not installed on every
// runner): a missing source root throws ENOENT and fails the test closed,
// instead of silently passing the boundary check.
function listSourceFiles(roots: readonly string[]): readonly string[] {
  const files: string[] = [];

  for (const root of roots) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed architecture-test roots
    const entries = readdirSync(path.join(REPO_ROOT, root), {
      recursive: true,
    }) as string[];

    for (const entry of entries) {
      const relativePath = `${root}/${entry.split(path.sep).join("/")}`;

      if (/\.[cm]?[jt]sx?$/u.test(relativePath)) {
        files.push(relativePath);
      }
    }
  }

  return files;
}

function readSource(relativePath: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed architecture-test paths
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function isFixtureModuleSpecifier(specifier: string): boolean {
  const fileName = specifier.split("/").at(-1) ?? "";
  const marker = ".fixtures";
  const markerIndex = fileName.lastIndexOf(marker);
  if (markerIndex < 0) return false;

  const extension = fileName.slice(markerIndex + marker.length);
  return (
    extension === "" ||
    [".js", ".jsx", ".ts", ".tsx", ".mjs", ".mts", ".cjs", ".cts"].includes(
      extension,
    )
  );
}

function importsFixtureModule(source: string): boolean {
  const sourceFile = ts.createSourceFile(
    "fixture-boundary.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let found = false;

  const visit = (node: ts.Node): void => {
    let specifier: ts.Expression | undefined;
    if (ts.isImportDeclaration(node)) {
      specifier = node.moduleSpecifier;
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      specifier = node.arguments[0];
    }

    if (
      specifier &&
      ts.isStringLiteralLike(specifier) &&
      isFixtureModuleSpecifier(specifier.text)
    ) {
      found = true;
      return;
    }

    if (!found) ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
}

function filesMatching(
  roots: readonly string[],
  pattern: RegExp,
): readonly string[] {
  return listSourceFiles(roots).filter((file) =>
    pattern.test(readSource(file)),
  );
}

describe("Storybook fixture runtime boundary", () => {
  it.each([
    ["static", 'import { hero } from "./hero.fixtures";'],
    ["dynamic", 'const hero = import("./hero.fixtures.ts");'],
    ["side-effect", 'import "./hero.fixtures";'],
  ])("recognizes %s fixture imports", (_kind, source) => {
    expect(importsFixtureModule(source)).toBe(true);
  });

  it("ignores fixture names in ordinary strings and comments", () => {
    expect(
      importsFixtureModule(`
        const note = "./hero.fixtures";
        // import "./comment-only.fixtures";
      `),
    ).toBe(false);
  });

  it("keeps fixture modules out of runtime imports", () => {
    const offenders = listSourceFiles(["src"])
      .filter((filePath) => importsFixtureModule(readSource(filePath)))
      .filter(
        (filePath) =>
          !allowedImportPathPatterns.some((allowedPattern) =>
            allowedPattern.test(filePath),
          ),
      );

    expect(offenders).toStrictEqual([]);
  });

  it("keeps runtime code from importing Storybook stories, even indirectly via a story barrel", () => {
    const offenders = filesMatching(["src"], storyImportPattern).filter(
      (filePath) =>
        !/\.test\.[cm]?[jt]sx?$/u.test(filePath) &&
        !/\.stories\.[cm]?[jt]sx?$/u.test(filePath),
    );

    expect(offenders).toStrictEqual([]);
  });

  it("keeps owner-visible stories free of Vercel/developer-platform motifs", () => {
    const offenders = listSourceFiles(ownerVisibleStoryRoots).filter(
      (filePath) =>
        /\.stories\.[cm]?[jt]sx?$/u.test(filePath) &&
        bannedStoryMotifPattern.test(readSource(filePath)),
    );

    expect(offenders).toStrictEqual([]);
  });
});
