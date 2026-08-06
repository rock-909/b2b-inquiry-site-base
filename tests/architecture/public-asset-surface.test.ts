/* eslint-disable security/detect-non-literal-fs-filename -- walks fixed in-repo trees (public/, src/, content/, messages/); no external input reaches these paths */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Public asset surface contract.
 *
 * Every file we ship from `public/` is a URL the world can request. A file with
 * no live consumer is a surface we cannot explain, cannot brand-check, and
 * cannot retire safely later. This guard asserts the live rule — each shipped
 * asset is referenced by production source or content — rather than pinning the
 * names of assets that were removed in the past.
 */

const PUBLIC_DIR = "public";

/** Trees that count as a live consumer. Tests and tooling do not. */
const CONSUMER_ROOTS = ["src", "content", "messages"] as const;

/**
 * Files served for reasons other than being referenced by a page: platform
 * headers, well-known endpoints, in-repo documentation, and directory keepers.
 */
const NON_REFERENCED_SURFACES = ["_headers", ".well-known/", "fonts/"] as const;

const IGNORED_BASENAMES = new Set(["README.md", ".gitkeep", ".DS_Store"]);

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

function toUrlPath(filePath: string): string {
  return `/${relative(PUBLIC_DIR, filePath).split(sep).join("/")}`;
}

function isExempt(urlPath: string, filePath: string): boolean {
  return (
    IGNORED_BASENAMES.has(basename(filePath)) ||
    NON_REFERENCED_SURFACES.some((surface) => urlPath.startsWith(`/${surface}`))
  );
}

function isTestFile(filePath: string): boolean {
  return (
    filePath.includes(`${sep}__tests__${sep}`) ||
    filePath.includes(".test.") ||
    filePath.includes(".stories.") ||
    filePath.includes(".fixtures.")
  );
}

function collectConsumerSources(): string[] {
  return CONSUMER_ROOTS.flatMap((root) => listFiles(root))
    .filter((filePath) => !isTestFile(filePath))
    .map((filePath) => readFileSync(filePath, "utf8"));
}

describe("public asset surface", () => {
  it("ships no asset that production source and content never reference", () => {
    const sources = collectConsumerSources();
    const shipped = listFiles(PUBLIC_DIR)
      .map((filePath) => ({ filePath, urlPath: toUrlPath(filePath) }))
      .filter(({ filePath, urlPath }) => !isExempt(urlPath, filePath));

    expect(shipped.length).toBeGreaterThan(0);

    const orphans = shipped
      .filter(
        ({ urlPath }) => !sources.some((source) => source.includes(urlPath)),
      )
      .map(({ urlPath }) => urlPath);

    expect(orphans).toEqual([]);
  });
});
