/* eslint-disable security/detect-non-literal-fs-filename -- This test intentionally scans fixed project source paths for public wording drift. */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PRODUCTION_ROOTS = ["messages", "content", "src"] as const;
const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".ts",
  ".tsx",
]);
const NON_PRODUCTION_DIRECTORIES = new Set([
  "__mocks__",
  "__tests__",
  "test",
  "testing",
]);
const NON_PRODUCTION_FILE_PATTERNS = [
  /\.d\.ts$/,
  /\.spec\.[cm]?[jt]sx?$/,
  /\.test\.[cm]?[jt]sx?$/,
];
const FORBIDDEN_LEGACY_STANDARD_MARKERS = [
  "UL 651",
  "ASTM D1785",
  "AS/NZS 2053",
  "NOM-001-SEDE",
  "IEC 61386",
] as const;

type SourceFile = {
  absolutePath: string;
  relativePath: string;
};

const isProductionSourcePath = (relativePath: string) => {
  const pathSegments = relativePath.split(path.sep);

  if (pathSegments.some((segment) => NON_PRODUCTION_DIRECTORIES.has(segment))) {
    return false;
  }

  return !NON_PRODUCTION_FILE_PATTERNS.some((pattern) =>
    pattern.test(relativePath),
  );
};

const collectProductionSourceFiles = (directory: string): SourceFile[] => {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(process.cwd(), absolutePath);

    if (!isProductionSourcePath(relativePath)) {
      return [];
    }

    if (entry.isDirectory()) {
      return collectProductionSourceFiles(absolutePath);
    }

    if (!entry.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      return [];
    }

    return [{ absolutePath, relativePath }];
  });
};

const readProjectFile = (relativePath: string) =>
  readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("starter example standard wording", () => {
  it("does not publish legacy product standard markers", () => {
    const offendingFiles = PRODUCTION_ROOTS.flatMap((root) =>
      collectProductionSourceFiles(path.join(process.cwd(), root)),
    ).flatMap(({ absolutePath, relativePath }) => {
      const content = readFileSync(absolutePath, "utf8");

      return FORBIDDEN_LEGACY_STANDARD_MARKERS.filter((marker) =>
        content.includes(marker),
      ).map((marker) => `${relativePath}: ${marker}`);
    });

    expect(offendingFiles).toEqual([]);
  });

  it("keeps materialized Tucsenberg catalog copy free of generic starter standards", () => {
    const catalogMessages = readProjectFile(
      "messages/profiles/catalog/en/messages.json",
    );
    const tucsenbergPages = readProjectFile(
      "src/constants/tucsenberg-product-pages.ts",
    );
    const materializedCopy = [catalogMessages, tucsenbergPages].join("\n");

    expect(materializedCopy).not.toContain("Example Standard");
    expect(materializedCopy).not.toContain("示例标准");
  });
});
