import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { getAllMarketSlugs } from "../../src/constants/product-catalog";
import { routing } from "../../src/i18n/routing-config";

const REPO_PATH_PATTERN = /^(?:content|messages|public|scripts|src|tests)\//u;
const QUOTED_REPO_PATH_PATTERN =
  /["']((?:content|messages|public|scripts|src|tests)\/[^"'\n]+)["']/gu;

// A directory exclusion is written `src/app/api/whatsapp/**`. Rejecting every
// candidate containing `*` skipped exactly those, so a deleted directory kept a
// live exemption on the books — the next file created at that path would be
// silently exempt. Resolve the `/**` suffix to its directory instead.
function toExactRepoPath(candidate: string): string | null {
  const resolved = candidate.replace(/\/\*\*$/u, "");
  if (!REPO_PATH_PATTERN.test(resolved)) return null;
  return /[?*{}]/u.test(resolved) ? null : resolved;
}

// A regex-anchored config path (dep-cruiser from.path/to.path) starts with the
// literal directory/file segment, then may switch into regex machinery. Extract
// the leading literal (unescaping `\.`, `\[`, `\]` etc.) up to the first real
// metacharacter, so we can assert the concrete prefix actually exists.
function extractRegexLiteralPrefix(pattern: string): string {
  const source = pattern.startsWith("^") ? pattern.slice(1) : pattern;
  let literal = "";
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") {
      const next = source[index + 1];
      if (next === undefined || /[dwsbDWSB]/u.test(next)) break;
      literal += next;
      index += 1;
      continue;
    }
    if ("[](){}.*+?|^$".includes(char ?? "")) break;
    literal += char;
  }
  return literal;
}

// Split only on top-level `|` (paths built via `[...].join("|")`), while leaving
// alternations inside `(...)`/`[...]` groups intact.
function splitTopLevelAlternation(pattern: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index] ?? "";
    if (char === "\\") {
      current += char + (pattern[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (char === "(" || char === "[") depth += 1;
    else if (char === ")" || char === "]") depth = Math.max(0, depth - 1);
    if (char === "|" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

// A regex path prefix "exists" when it resolves to a real dir/file, or the
// parent dir holds an entry with that basename (covers `src/lib/resend` →
// `resend.ts`). This avoids false positives on prefix-style patterns while still
// catching targets whose directory/file was deleted.
function pathPrefixExists(prefix: string): boolean {
  const cleaned = prefix.replace(/\/+$/u, "");
  if (cleaned === "") return false;
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test validates repo-local config paths
  if (fs.existsSync(cleaned)) return true;
  const parent = path.dirname(cleaned);
  const base = path.basename(cleaned);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test validates repo-local config paths
  if (!fs.existsSync(parent)) return false;
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test validates repo-local config paths
  return fs.readdirSync(parent).some((entry) => entry.startsWith(base));
}

interface DepCruiserRule {
  readonly from?: { readonly path?: string | string[] };
  readonly to?: { readonly path?: string | string[] };
}

function loadDepCruiserForbiddenRules(): DepCruiserRule[] {
  const require = createRequire(import.meta.url);
  const config = require("../../.dependency-cruiser.js") as {
    forbidden?: DepCruiserRule[];
  };
  return config.forbidden ?? [];
}

function toAlternatives(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).flatMap((pattern) =>
    splitTopLevelAlternation(pattern),
  );
}

// A `from.path` that resolves to nothing means the rule can never match a source
// file — it is provably dead. This is the unambiguous "config path was deleted"
// signal we police.
function collectDepCruiserDeadFromPaths(): string[] {
  return loadDepCruiserForbiddenRules()
    .flatMap((rule) => toAlternatives(rule.from?.path))
    .map((alternative) => extractRegexLiteralPrefix(alternative))
    .filter((candidate) => REPO_PATH_PATTERN.test(candidate))
    .filter((prefix) => !pathPrefixExists(prefix));
}

// A `to.path` anchored to one concrete file (e.g. `^…/product-actions\.tsx$`)
// that no longer exists is a stale reference to a deleted module. Prefix-style
// `to` targets (e.g. `src/constants/test-`) are intentionally NOT checked: they
// are forward-looking bans whose target may legitimately not exist yet.
function isExactFileTarget(alternative: string): boolean {
  return (
    alternative.endsWith("$") &&
    /\.[a-z0-9]+$/u.test(extractRegexLiteralPrefix(alternative))
  );
}

function collectDepCruiserDeadToFiles(): string[] {
  return (
    loadDepCruiserForbiddenRules()
      .flatMap((rule) => toAlternatives(rule.to?.path))
      .filter(isExactFileTarget)
      .map((alternative) => extractRegexLiteralPrefix(alternative))
      .filter((candidate) => REPO_PATH_PATTERN.test(candidate))
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test validates repo-local config paths
      .filter((filePath) => !fs.existsSync(filePath))
  );
}

// Resolve a Lighthouse audit URL pathname against the App Router tree: each
// segment is a literal dir or the sole dynamic `[param]` dir; `[market]` slugs
// are validated against the live catalog. Returns true only when it lands on a
// real page.tsx — so an audited URL can never silently point at a 404.
function appRouteResolves(pathnameSegments: string[]): boolean {
  // Canonical URLs carry no locale segment under `localePrefix: 'never'`, but a
  // future prefix strategy would add one. Accept a leading configured locale;
  // an unknown prefix (e.g. a re-introduced `/zh/...`) falls through to the
  // tree walk, which rejects it because no such route directory exists.
  const [firstSegment, ...restSegments] = pathnameSegments;
  const routeSegments = (routing.locales as readonly string[]).includes(
    firstSegment ?? "",
  )
    ? restSegments
    : pathnameSegments;

  let dir = "src/app/[locale]";
  for (const segment of routeSegments) {
    const currentDir = dir;
    const staticDir = path.join(currentDir, segment);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test walks the repo-local app router tree
    if (fs.existsSync(staticDir) && fs.statSync(staticDir).isDirectory()) {
      dir = staticDir;
      continue;
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test walks the repo-local app router tree
    const dynamicDirs = fs.readdirSync(currentDir).filter(
      (entry: string) =>
        /^\[.+\]$/u.test(entry) &&
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- entry comes from readdir of a repo-local dir
        fs.statSync(path.join(currentDir, entry)).isDirectory(),
    );
    if (dynamicDirs.length !== 1) return false;
    const dynamicDir = dynamicDirs[0] ?? "";
    // A catch-all segment (`[...rest]`) exists only to render notFound(); a path
    // that resolves *into* it is by definition a dead route, not a real page.
    if (dynamicDir.startsWith("[...")) return false;
    if (dynamicDir === "[market]" && !getAllMarketSlugs().includes(segment)) {
      return false;
    }
    dir = path.join(currentDir, dynamicDir);
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test checks a repo-local page module
  return fs.existsSync(path.join(dir, "page.tsx"));
}

function collectLighthouseRoutePathSegments(): string[][] {
  const source = fs.readFileSync("lighthouserc.js", "utf8");
  const urls = [...source.matchAll(/http:\/\/localhost:3000([^"']*)/gu)].map(
    (match) => match[1] ?? "",
  );
  return [...new Set(urls)].map((pathname) =>
    // keep the full path incl. the locale segment; appRouteResolves validates
    // the locale prefix against routing.locales.
    pathname.split("/").filter((segment) => segment !== ""),
  );
}

function getMissingPaths(paths: Iterable<string>): string[] {
  return (
    [...new Set(paths)]
      .flatMap((candidate) => {
        const resolved = toExactRepoPath(candidate);
        return resolved === null ? [] : [resolved];
      })
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test validates repo-local config paths
      .filter((repoPath) => !fs.existsSync(repoPath))
      .sort()
  );
}

function extractQuotedRepoPaths(configPath: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- configPath comes from the fixed test cases below
  const source = fs.readFileSync(configPath, "utf8");
  return [...source.matchAll(QUOTED_REPO_PATH_PATTERN)].map(
    (match) => match[1] ?? "",
  );
}

describe("exact repository paths in configuration", () => {
  it("keeps React Doctor override paths live", () => {
    const config = JSON.parse(
      fs.readFileSync("doctor.config.json", "utf8"),
    ) as {
      ignore?: { overrides?: Array<{ files?: string[] }> };
    };
    const paths =
      config.ignore?.overrides?.flatMap((override) => override.files ?? []) ??
      [];

    expect(getMissingPaths(paths)).toEqual([]);
  });

  it.each(["eslint.config.mjs", "vitest.config.mts"])(
    "keeps exact paths live in %s",
    (configPath) => {
      expect(getMissingPaths(extractQuotedRepoPaths(configPath))).toEqual([]);
    },
  );

  it("keeps exact Semgrep exclusions live", () => {
    const paths = fs
      .readFileSync("semgrep.yml", "utf8")
      .split(/\r?\n/u)
      .flatMap((line) => {
        const match = line.match(/^\s*-\s+["']?([^"'#]+?)["']?\s*$/u);
        return match?.[1] ? [match[1].replace(/^\*\*\//u, "")] : [];
      });

    expect(getMissingPaths(paths)).toEqual([]);
  });

  // Guards against the "config references a deleted path → rule silently dead"
  // class of bugs for dep-cruiser, whose from/to targets are anchored regexes.
  it("keeps dependency-cruiser rule source paths live", () => {
    expect(collectDepCruiserDeadFromPaths().sort()).toEqual([]);
  });

  it("keeps dependency-cruiser exact-file ban targets live", () => {
    expect(collectDepCruiserDeadToFiles().sort()).toEqual([]);
  });

  // Same class for Lighthouse: every audited URL must map to a real App Router
  // page, so the performance proof can never quietly audit a 404.
  it("keeps Lighthouse audit URLs mapped to real routes", () => {
    const unresolved = collectLighthouseRoutePathSegments()
      .filter((segments) => !appRouteResolves(segments))
      .map((segments) => `/${segments.join("/")}`)
      .sort();

    expect(unresolved).toEqual([]);
  });
});
