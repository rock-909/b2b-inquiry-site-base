import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getFontClassNames,
  jetbrainsMono,
  systemSans,
} from "@/app/[locale]/layout-fonts";

const layoutFontsSource = readFileSync(
  join(process.cwd(), "src/app/[locale]/layout-fonts.ts"),
  "utf8",
);
const globalsCssSource = readFileSync(
  join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

const legacyFontClassPattern = /--font-|open-sans|jetbrains/i;
const nextFontSourcePattern = /next\/font|Open_Sans|JetBrains_Mono/i;
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
  describe("systemSans font", () => {
    it("uses the system sans stack without a webfont class", () => {
      expect(systemSans).toBeDefined();
      expect(systemSans.variable).toBe("");
      expect(systemSans.className).toBe("");
      expect(systemSans.style.fontFamily).toContain("system-ui");
      expect(systemSans.style.fontFamily).toContain("Segoe UI");
    });
  });

  describe("jetbrainsMono font", () => {
    it("keeps the monospace fallback token available", () => {
      expect(jetbrainsMono).toBeDefined();
      expect(jetbrainsMono.variable).toBe("");
      expect(jetbrainsMono.className).toBe("");
      expect(jetbrainsMono.style.fontFamily).toContain("ui-monospace");
    });
  });

  describe("getFontClassNames", () => {
    it("does not add next/font webfont classes to the html element", () => {
      expect(getFontClassNames()).toBe("");
      expect(getFontClassNames()).not.toMatch(legacyFontClassPattern);
    });
  });

  describe("webfont source contract", () => {
    it("does not import next/font loaders in the locale font helper", () => {
      expect(layoutFontsSource).not.toMatch(nextFontSourcePattern);
    });

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
