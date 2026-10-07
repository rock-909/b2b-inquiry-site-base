import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const globalsCssSource = readFileSync(
  join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

const legacyCssFontVariablePattern =
  /--font-open-sans|--font-jetbrains-mono|open-sans|jetbrains/i;
const productionSourceForbiddenPattern =
  /next\/font\/(?:google|local)|Open_Sans|JetBrains_Mono|["']Open Sans["']|--font-open-sans|--font-jetbrains-mono|\.woff2?\b|fonts\.googleapis\.com|fonts\.gstatic\.com|@import\s+(?:url\()?["']?https?:\/\//;
const productionSourceRoots = ["src/app", "src/components", "src/lib"];
const productionSourceExtensions = new Set([".css", ".ts", ".tsx"]);
const excludedProductionSourceSegments = new Set([
  "__tests__",
  "__mocks__",
  "test",
  "tests",
  "testing",
]);

function collectProductionSourceFiles(root: string): string[] {
  const rootPath = join(process.cwd(), root);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test recursively scans fixed repo-local production roots
  const entries = readdirSync(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(rootPath, entry.name);

    if (entry.isDirectory()) {
      if (!excludedProductionSourceSegments.has(entry.name)) {
        files.push(...collectProductionSourceFiles(join(root, entry.name)));
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = entry.name.slice(entry.name.lastIndexOf("."));
    if (productionSourceExtensions.has(extension)) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("Layout Fonts Configuration", () => {
  describe("webfont source contract", () => {
    it("does not reference legacy webfont variables in typography CSS", () => {
      expect(globalsCssSource).not.toMatch(legacyCssFontVariablePattern);
    });

    it("does not reintroduce default webfont payload in production source", () => {
      const productionSourceFiles = productionSourceRoots.flatMap(
        collectProductionSourceFiles,
      );
      const filesWithForbiddenWebfontReferences = productionSourceFiles.filter(
        (filePath) => {
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- file paths come from the fixed repo-local production scan above
          const source = readFileSync(filePath, "utf8");

          return productionSourceForbiddenPattern.test(source);
        },
      );

      expect(filesWithForbiddenWebfontReferences).toEqual([]);
    });
  });
});
