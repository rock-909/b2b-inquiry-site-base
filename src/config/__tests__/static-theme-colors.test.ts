import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STATIC_THEME_COLORS } from "@/config/static-theme-colors";
import { COLORS } from "@/emails/theme";

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const IMPORT_FROM_PATTERN = /from\s+["']([^"']+)["']/g;
const BRIDGE_SOURCE = readFileSync("src/config/static-theme-colors.ts", "utf8");
const BROWSER_UI_SCAN_ROOTS = [
  "src/components",
  "src/app",
  "src/styles",
] as const;

function collectFiles(directoryPath: string): string[] {
  let entries: string[];

  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-only boundary scan walks approved repo directories to catch browser UI imports
    entries = readdirSync(directoryPath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  return entries.flatMap((entry) => {
    const entryPath = join(directoryPath, entry);

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-only boundary scan inspects discovered repo paths under approved directories
    if (statSync(entryPath).isDirectory()) {
      return collectFiles(entryPath);
    }

    return [entryPath];
  });
}

function importsStaticThemeColors(source: string) {
  return Array.from(source.matchAll(IMPORT_FROM_PATTERN)).some((match) => {
    const specifier = match[1];

    if (!specifier) {
      return false;
    }

    return (
      specifier === "@/config/static-theme-colors" ||
      specifier === "@/config/static-theme-colors.ts" ||
      (specifier.startsWith(".") &&
        (specifier.endsWith("/static-theme-colors") ||
          specifier.endsWith("/static-theme-colors.ts")))
    );
  });
}

describe("static theme colors", () => {
  it("exposes email-safe sRGB values for non-CSS surfaces", () => {
    expect(Object.keys(STATIC_THEME_COLORS).sort()).toEqual([
      "background",
      "border",
      "contentBackground",
      "headerText",
      "muted",
      "primaryText",
      "success",
      "successLight",
      "text",
      "textLight",
    ]);
  });

  it("keeps every exported value as a full hex color", () => {
    for (const [name, value] of Object.entries(STATIC_THEME_COLORS)) {
      expect(value, name).toMatch(HEX_COLOR_PATTERN);
    }
  });

  it("maps the email primary alias to primaryText", () => {
    expect(COLORS.primary).toBe(STATIC_THEME_COLORS.primaryText);
    expect(COLORS.primary).toBe("#005993");
  });

  it("documents the bridge boundary instead of pretending to be brand truth", () => {
    expect(BRIDGE_SOURCE).toContain("sRGB bridge for src/app/globals.css");
    expect(BRIDGE_SOURCE).toContain("manually reviewed sRGB snapshot");
    expect(BRIDGE_SOURCE).toContain("semantic token palette");
    expect(BRIDGE_SOURCE).toContain("non-CSS surfaces only");
    expect(BRIDGE_SOURCE).toContain("not the brand truth source");
  });

  it("stays out of browser ui and browser-ui config surfaces", () => {
    const browserUiFiles = [
      ...BROWSER_UI_SCAN_ROOTS.flatMap((directoryPath) =>
        collectFiles(directoryPath),
      ),
    ].filter(
      (filePath, index, allFiles) =>
        allFiles.indexOf(filePath) === index &&
        filePath !== "src/config/static-theme-colors.ts" &&
        filePath !== "src/config/__tests__/static-theme-colors.test.ts" &&
        !filePath.startsWith("src/emails/") &&
        /\.(ts|tsx|css)$/.test(filePath),
    );

    const offenders = browserUiFiles.filter((filePath) => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-only boundary scan reads approved repo source files to enforce non-CSS bridge isolation
      return importsStaticThemeColors(readFileSync(filePath, "utf8"));
    });

    expect(offenders).toEqual([]);
  });
});
