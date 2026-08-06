import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_CONFIG } from "@/config/paths";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const RUNTIME_SOURCE_ROOTS = [
  "src/app",
  "src/components",
  "src/hooks",
  "src/lib",
];

const WEBSITE_CONFIG_PREFIX = "@/config/website";
const IMPORT_SPECIFIER_PATTERN =
  /(?:from\s+["']|import\s*[(]?\s*["']|require\s*[(]\s*["'])([^"']+)["']/gu;
const SITE_CONFIG_BRAND_ASSETS_PATTERN = /\bSITE_CONFIG\s*\.\s*brandAssets\b/u;

function read(repoPath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads repo-local files from fixed scan roots
  return readFileSync(repoPath, "utf8");
}

function walkSourceFiles(dir: string, results: string[] = []) {
  let entries: Dirent<string>[];

  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test recursively scans fixed repo-local runtime roots
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return results;
    }

    throw error;
  }

  for (const entry of entries) {
    const absolutePath = join(dir, entry.name);

    if (entry.isDirectory()) {
      walkSourceFiles(absolutePath, results);
      continue;
    }

    if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
      results.push(relative(process.cwd(), absolutePath).split(sep).join("/"));
    }
  }

  return results;
}

function findWebsiteConfigImports(source: string) {
  const specifiers: string[] = [];

  for (const match of source.matchAll(IMPORT_SPECIFIER_PATTERN)) {
    const specifier = match[1];

    if (!specifier) {
      continue;
    }

    if (
      specifier === WEBSITE_CONFIG_PREFIX ||
      specifier.startsWith(`${WEBSITE_CONFIG_PREFIX}/`)
    ) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

describe("website config runtime boundary", () => {
  it("keeps replacement website config out of runtime app dependencies", () => {
    const offenders: string[] = [];

    for (const root of RUNTIME_SOURCE_ROOTS) {
      for (const repoPath of walkSourceFiles(root)) {
        const source = read(repoPath);
        const imports = findWebsiteConfigImports(source);

        for (const specifier of imports) {
          offenders.push(`${repoPath} -> ${specifier}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps brand asset facts out of the SITE_CONFIG runtime facade", () => {
    expect(Object.hasOwn(SITE_CONFIG, "brandAssets")).toBe(false);
  });

  it("keeps runtime source from reading brand assets through SITE_CONFIG", () => {
    const offenders: string[] = [];

    for (const root of RUNTIME_SOURCE_ROOTS) {
      for (const repoPath of walkSourceFiles(root)) {
        const source = read(repoPath);

        if (SITE_CONFIG_BRAND_ASSETS_PATTERN.test(source)) {
          offenders.push(repoPath);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("catches direct, nested, dynamic, and require imports", () => {
    const examples = [
      'import { websiteProfile } from "@/config/website";',
      'import { websiteProfile } from "@/config/website/profile";',
      'export { websiteProfile } from "@/config/website/profile";',
      'await import("@/config/website/profile");',
      'require("@/config/website/profile");',
    ];

    for (const source of examples) {
      const matches = findWebsiteConfigImports(source);

      expect(matches).toHaveLength(1);
    }
  });
});
