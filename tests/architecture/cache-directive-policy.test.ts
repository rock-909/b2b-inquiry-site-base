import { existsSync, readFileSync } from "node:fs";
import { parse } from "@babel/parser";
import { describe, expect, it } from "vitest";

const CRITICAL_CACHE_POLICY_FILES = [
  "src/app/api/inquiry/route.ts",
  "src/app/api/health/route.ts",
] as const;

const BANNED_NEXT_CACHE_IMPORTS = new Set<string>([
  "unstable_cache",
  "cacheLife",
  "cacheTag",
  // Next 16 on-demand invalidation family, all exported from next/cache
  // (see node_modules/next/dist/docs/01-app/03-api-reference/04-functions/).
  // Runtime tag/path invalidation is banned on this Cloudflare/OpenNext
  // deployment; content flows through rebuild/redeploy.
  "revalidateTag",
  "revalidatePath",
  "updateTag",
  "refresh",
]);

const CRITICAL_CACHE_POLICY_SOURCE_READERS = {
  "src/app/api/inquiry/route.ts": () =>
    readFileSync("src/app/api/inquiry/route.ts", "utf8"),
  "src/app/api/health/route.ts": () =>
    readFileSync("src/app/api/health/route.ts", "utf8"),
} satisfies Record<(typeof CRITICAL_CACHE_POLICY_FILES)[number], () => string>;

const CONTACT_PAGE_FILE = "src/app/[locale]/contact/page.tsx";
const CONTACT_PAGE_DATA_FILE = "src/app/[locale]/contact/contact-page-data.ts";
const PRODUCT_MARKET_SOURCE_FILES = [
  "src/app/[locale]/products/[market]/page.tsx",
  "src/app/[locale]/products/[market]/market-jsonld.ts",
] as const;
const USE_CACHE_DIRECTIVE_PATTERN = /["'`]\s*use\s+cache\s*["'`]/i;
const NEXT_CACHE_IMPORT_PATTERN = /from\s+["'`]\s*next\/cache\s*["'`]/i;
const PRODUCT_MARKET_FAQ_HELPER = "getProductMarketFaqItems";
const PRODUCT_MARKET_FAQ_HELPER_PATTERN = /\bgetProductMarketFaqItems\b/;
const PRODUCT_MARKET_MDX_READ_PATTERN =
  /\bgetPageBySlug\s*\(\s*["'`]product-market["'`]/i;
const FAQ_SCHEMA_TYPE = "FAQPage";
const FAQ_SCHEMA_TYPE_PATTERN = /\bFAQPage\b/;

function readProductMarketSource(filePath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test checks repo-local allowlisted files
  if (!existsSync(filePath)) {
    throw new Error(`Missing product market source file: ${filePath}`);
  }

  return {
    filePath,
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test checks repo-local allowlisted files
    source: readFileSync(filePath, "utf8"),
  };
}

function readProductMarketSources() {
  return PRODUCT_MARKET_SOURCE_FILES.map(readProductMarketSource);
}

type AstRecord = Record<string, unknown>;

function isAstRecord(value: unknown): value is AstRecord {
  return typeof value === "object" && value !== null;
}

function readStringProperty(record: AstRecord, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function readNumberProperty(record: AstRecord, key: string) {
  const value = record[key];
  return typeof value === "number" ? value : undefined;
}

function readDirectiveValue(node: AstRecord) {
  const value = node.value;

  if (!isAstRecord(value)) {
    return undefined;
  }

  return readStringProperty(value, "value");
}

function readDirectiveLine(node: AstRecord) {
  const loc = node.loc;

  if (!isAstRecord(loc)) {
    return undefined;
  }

  const start = loc.start;

  if (!isAstRecord(start)) {
    return undefined;
  }

  return readNumberProperty(start, "line");
}

function readCriticalFileSource(
  filePath: (typeof CRITICAL_CACHE_POLICY_FILES)[number],
) {
  return CRITICAL_CACHE_POLICY_SOURCE_READERS[filePath]();
}

function parseModule(filePath: (typeof CRITICAL_CACHE_POLICY_FILES)[number]) {
  return parse(readCriticalFileSource(filePath), {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });
}

function collectUseCacheDirectives(
  node: unknown,
  directiveLocations: string[],
) {
  if (Array.isArray(node)) {
    for (const child of node) {
      collectUseCacheDirectives(child, directiveLocations);
    }

    return;
  }

  if (!isAstRecord(node)) {
    return;
  }

  if (
    readStringProperty(node, "type") === "Directive" &&
    readDirectiveValue(node) === "use cache"
  ) {
    const line = readDirectiveLine(node);
    directiveLocations.push(
      line === undefined ? "unknown line" : `line ${line}`,
    );
  }

  for (const child of Object.values(node)) {
    collectUseCacheDirectives(child, directiveLocations);
  }
}

function findUseCacheDirectives(
  filePath: (typeof CRITICAL_CACHE_POLICY_FILES)[number],
) {
  const ast = parseModule(filePath);
  const directiveLocations: string[] = [];

  collectUseCacheDirectives(ast.program, directiveLocations);

  return directiveLocations;
}

function findBannedNextCacheImports(
  filePath: (typeof CRITICAL_CACHE_POLICY_FILES)[number],
) {
  const ast = parseModule(filePath);
  const bannedImports: string[] = [];

  for (const node of ast.program.body) {
    if (
      node.type !== "ImportDeclaration" ||
      node.source.value !== "next/cache"
    ) {
      continue;
    }

    for (const specifier of node.specifiers) {
      if (specifier.type !== "ImportSpecifier") {
        continue;
      }

      const importedName =
        specifier.imported.type === "Identifier"
          ? specifier.imported.name
          : specifier.imported.value;

      if (BANNED_NEXT_CACHE_IMPORTS.has(importedName)) {
        bannedImports.push(importedName);
      }
    }
  }

  return bannedImports;
}

describe("cache directive policy", () => {
  it("keeps critical routes and actions free of use cache directives", () => {
    for (const filePath of CRITICAL_CACHE_POLICY_FILES) {
      expect(
        findUseCacheDirectives(filePath),
        `${filePath} should not declare use cache`,
      ).toEqual([]);
    }
  });

  it("does not import cache-component helpers into critical routes and actions", () => {
    for (const filePath of CRITICAL_CACHE_POLICY_FILES) {
      expect(
        findBannedNextCacheImports(filePath),
        `${filePath} should not import cache-component helpers from next/cache`,
      ).toEqual([]);
    }
  });

  it("keeps contact static content loading in the page data module without runtime cache invalidation", () => {
    const routeSource = readFileSync(CONTACT_PAGE_FILE, "utf8");
    const dataSource = readFileSync(CONTACT_PAGE_DATA_FILE, "utf8");

    expect(routeSource).not.toContain("CONTENT_MANIFEST");
    expect(dataSource).toContain(
      'import { CONTENT_MANIFEST } from "@/lib/content-manifest.generated"',
    );

    for (const source of [routeSource, dataSource]) {
      expect(source).not.toMatch(USE_CACHE_DIRECTIVE_PATTERN);
      expect(source).not.toMatch(NEXT_CACHE_IMPORT_PATTERN);
      expect(source).not.toContain("cacheTag(");
      expect(source).not.toContain("revalidateTag(");
      expect(source).not.toContain("revalidatePath(");
    }
  });

  it("keeps product market route sources free of shared FAQ and cache workarounds", () => {
    expect(PRODUCT_MARKET_FAQ_HELPER).toMatch(
      PRODUCT_MARKET_FAQ_HELPER_PATTERN,
    );
    expect(FAQ_SCHEMA_TYPE).toMatch(FAQ_SCHEMA_TYPE_PATTERN);

    for (const { filePath, source } of readProductMarketSources()) {
      expect(source, filePath).not.toMatch(USE_CACHE_DIRECTIVE_PATTERN);
      expect(source, filePath).not.toMatch(NEXT_CACHE_IMPORT_PATTERN);
      expect(source, filePath).not.toMatch(PRODUCT_MARKET_FAQ_HELPER_PATTERN);
      expect(source, filePath).not.toMatch(PRODUCT_MARKET_MDX_READ_PATTERN);
      expect(source, filePath).not.toContain("<FaqSection");
      expect(source, filePath).not.toContain("generateFaqSchemaFromItems");
      expect(source, filePath).not.toMatch(FAQ_SCHEMA_TYPE_PATTERN);
      expect(source, filePath).not.toContain("cacheLife(");
      expect(source, filePath).not.toContain("cacheTag(");
      expect(source, filePath).not.toContain("revalidateTag(");
      expect(source, filePath).not.toContain("revalidatePath(");
    }
  });
});
