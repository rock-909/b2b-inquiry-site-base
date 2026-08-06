import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const SCRIPT_PATH = path.join(
  REPO_ROOT,
  "scripts/quality/checks/cloudflare-official-compare.js",
);
const TEST_TRASH_DIR = path.join(
  os.tmpdir(),
  "tucsenberg-cloudflare-official-compare-test-trash",
);
const requireModule = createRequire(path.join(REPO_ROOT, "package.json"));
const tempDirs: string[] = [];
const CANONICAL_CLOUDFLARE_BUILD_SCRIPTS = {
  "website:build:cf":
    "DEPLOYMENT_PLATFORM=cloudflare NEXT_PUBLIC_DEPLOYMENT_PLATFORM=cloudflare pnpm exec opennextjs-cloudflare build",
  "website:build:cf:debug":
    "DEPLOYMENT_PLATFORM=cloudflare NEXT_PUBLIC_DEPLOYMENT_PLATFORM=cloudflare pnpm exec opennextjs-cloudflare build --noMinify",
};
const PINNED_OPEN_NEXT_DEPENDENCY =
  "https://pkg.pr.new/@opennextjs/cloudflare@69807b1";

interface Failure {
  readonly file: string;
  readonly missing: readonly string[];
  readonly forbidden: readonly string[];
}
interface CloudflareOfficialCompareModule {
  readonly collectCloudflareOfficialCompareFailures: (
    rootDir?: string,
  ) => Failure[];
  readonly runCloudflareOfficialCompareCli: (args?: string[]) => boolean;
}

function loadChecker(): CloudflareOfficialCompareModule {
  return requireModule(SCRIPT_PATH) as CloudflareOfficialCompareModule;
}

function writeFixtureFile(
  rootDir: string,
  relativePath: string,
  content: string,
): void {
  const filePath = path.join(rootDir, relativePath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- writes a test-owned fixture under a temp root
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- writes a test-owned fixture under a temp root
  fs.writeFileSync(filePath, content);
}

// Valid open-next config + package.json so only the surface under test fails.
function writePassingSideFiles(rootDir: string): void {
  writeFixtureFile(
    rootDir,
    "open-next.config.ts",
    [
      'import { defineCloudflareConfig } from "@opennextjs/cloudflare";',
      'import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";',
      "export default defineCloudflareConfig({ incrementalCache: r2IncrementalCache });",
      "",
    ].join("\n"),
  );
  writeFixtureFile(
    rootDir,
    "package.json",
    JSON.stringify({
      scripts: CANONICAL_CLOUDFLARE_BUILD_SCRIPTS,
      devDependencies: {
        "@opennextjs/cloudflare": PINNED_OPEN_NEXT_DEPENDENCY,
      },
    }),
  );
}

function writePassingWranglerConfig(rootDir: string): void {
  writeFixtureFile(
    rootDir,
    "wrangler.jsonc",
    [
      "{",
      '  "main": ".open-next/worker.js",',
      '  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],',
      '  "assets": { "binding": "ASSETS" },',
      '  "env": {',
      '    "preview": { "r2_buckets": [{ "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "tucsenberg-site-cache-preview" }] },',
      '    "production": { "r2_buckets": [{ "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "tucsenberg-site-cache-production" }] }',
      "  }",
      "}",
    ].join("\n"),
  );
}

function createFixture(): string {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "tucsenberg-cloudflare-official-compare-"),
  );
  tempDirs.push(rootDir);
  return rootDir;
}

function moveFixtureToTrash(rootDir: string): void {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- creates the test-owned temp trash root
  fs.mkdirSync(TEST_TRASH_DIR, { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- cleanup moves a test-owned fixture to recoverable temp trash
  fs.renameSync(rootDir, path.join(TEST_TRASH_DIR, path.basename(rootDir)));
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const tempDir of tempDirs.splice(0)) {
    moveFixtureToTrash(tempDir);
  }
});

describe("Cloudflare official-compare source contract", () => {
  it("rejects required config that appears only in comments", () => {
    const rootDir = createFixture();
    writePassingSideFiles(rootDir);
    // Required wrangler values present only in a comment must NOT satisfy.
    writeFixtureFile(
      rootDir,
      "wrangler.jsonc",
      [
        "{",
        '  // "main": ".open-next/worker.js", "binding": "ASSETS",',
        '  // "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"]',
        '  "name": "fixture"',
        "}",
      ].join("\n"),
    );
    const failures =
      loadChecker().collectCloudflareOfficialCompareFailures(rootDir);

    expect(failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: "wrangler.jsonc" }),
      ]),
    );
  });

  it("does not trip on a forbidden token that appears only in a comment", () => {
    const rootDir = createFixture();
    writePassingSideFiles(rootDir);
    writeFixtureFile(
      rootDir,
      "wrangler.jsonc",
      [
        "{",
        '  "main": ".open-next/worker.js",',
        '  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],',
        "  // historical note: r2_buckets and d1_databases were never added",
        '  "assets": { "binding": "ASSETS" },',
        '  "env": {',
        '    "preview": { "r2_buckets": [{ "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "tucsenberg-site-cache-preview" }] },',
        '    "production": { "r2_buckets": [{ "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "tucsenberg-site-cache-production" }] }',
        "  }",
        "}",
      ].join("\n"),
    );

    const failures =
      loadChecker().collectCloudflareOfficialCompareFailures(rootDir);

    expect(failures).toEqual([]);
  });

  it("accepts the canonical Cloudflare build script surface", () => {
    const rootDir = createFixture();
    writePassingSideFiles(rootDir);
    writePassingWranglerConfig(rootDir);

    const failures =
      loadChecker().collectCloudflareOfficialCompareFailures(rootDir);

    expect(failures).toEqual([]);
  });

  it("rejects an imported R2 adapter that is not wired into the config", () => {
    const rootDir = createFixture();
    writePassingSideFiles(rootDir);
    writePassingWranglerConfig(rootDir);
    writeFixtureFile(
      rootDir,
      "open-next.config.ts",
      [
        'import { defineCloudflareConfig } from "@opennextjs/cloudflare";',
        'import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";',
        "void r2IncrementalCache;",
        "export default defineCloudflareConfig({});",
        "",
      ].join("\n"),
    );

    const failures =
      loadChecker().collectCloudflareOfficialCompareFailures(rootDir);

    expect(failures).toEqual([
      expect.objectContaining({
        file: "open-next.config.ts",
        missing: expect.arrayContaining([
          "incrementalCache: r2IncrementalCache",
        ]),
      }),
    ]);
  });

  it("rejects same-named local symbols instead of the OpenNext imports", () => {
    const rootDir = createFixture();
    writePassingSideFiles(rootDir);
    writePassingWranglerConfig(rootDir);
    writeFixtureFile(
      rootDir,
      "open-next.config.ts",
      [
        "const defineCloudflareConfig = (config: unknown) => config;",
        "const r2IncrementalCache = {};",
        "export default defineCloudflareConfig({ incrementalCache: r2IncrementalCache });",
        "",
      ].join("\n"),
    );

    const failures =
      loadChecker().collectCloudflareOfficialCompareFailures(rootDir);

    expect(failures).toEqual([
      expect.objectContaining({
        file: "open-next.config.ts",
        missing: expect.arrayContaining([
          "incrementalCache: r2IncrementalCache",
        ]),
      }),
    ]);
  });

  it("rejects a production environment without its dedicated R2 binding", () => {
    const rootDir = createFixture();
    writePassingSideFiles(rootDir);
    writeFixtureFile(
      rootDir,
      "wrangler.jsonc",
      [
        "{",
        '  "main": ".open-next/worker.js",',
        '  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],',
        '  "assets": { "binding": "ASSETS" },',
        '  "env": {',
        '    "preview": { "r2_buckets": [{ "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "tucsenberg-site-cache-preview" }] }',
        "  }",
        "}",
      ].join("\n"),
    );

    const failures =
      loadChecker().collectCloudflareOfficialCompareFailures(rootDir);

    expect(failures).toEqual([
      expect.objectContaining({
        file: "wrangler.jsonc",
        missing: expect.arrayContaining([
          expect.stringContaining("env.production.r2_buckets"),
        ]),
      }),
    ]);
  });

  it("rejects the moving PR package reference", () => {
    const rootDir = createFixture();
    writePassingSideFiles(rootDir);
    writePassingWranglerConfig(rootDir);
    writeFixtureFile(
      rootDir,
      "package.json",
      JSON.stringify({
        scripts: CANONICAL_CLOUDFLARE_BUILD_SCRIPTS,
        devDependencies: {
          "@opennextjs/cloudflare":
            "https://pkg.pr.new/@opennextjs/cloudflare@1318",
        },
      }),
    );

    const failures =
      loadChecker().collectCloudflareOfficialCompareFailures(rootDir);

    expect(failures).toEqual([
      expect.objectContaining({
        file: "package.json",
        missing: [`@opennextjs/cloudflare: ${PINNED_OPEN_NEXT_DEPENDENCY}`],
      }),
    ]);
  });

  it("rejects a Cloudflare build script with the wrong platform value", () => {
    const rootDir = createFixture();
    writePassingSideFiles(rootDir);
    writePassingWranglerConfig(rootDir);
    writeFixtureFile(
      rootDir,
      "package.json",
      JSON.stringify({
        scripts: {
          ...CANONICAL_CLOUDFLARE_BUILD_SCRIPTS,
          "website:build:cf":
            "DEPLOYMENT_PLATFORM=vercel NEXT_PUBLIC_DEPLOYMENT_PLATFORM=cloudflare pnpm exec opennextjs-cloudflare build",
        },
        devDependencies: {
          "@opennextjs/cloudflare": PINNED_OPEN_NEXT_DEPENDENCY,
        },
      }),
    );

    const failures =
      loadChecker().collectCloudflareOfficialCompareFailures(rootDir);

    expect(failures).toEqual([
      expect.objectContaining({ file: "package.json" }),
    ]);
  });

  it("rejects a Cloudflare build script with extra env prefixes", () => {
    const rootDir = createFixture();
    writePassingSideFiles(rootDir);
    writePassingWranglerConfig(rootDir);
    writeFixtureFile(
      rootDir,
      "package.json",
      JSON.stringify({
        scripts: {
          ...CANONICAL_CLOUDFLARE_BUILD_SCRIPTS,
          "website:build:cf":
            "NODE_OPTIONS=--inspect DEPLOYMENT_PLATFORM=cloudflare NEXT_PUBLIC_DEPLOYMENT_PLATFORM=cloudflare pnpm exec opennextjs-cloudflare build",
        },
        devDependencies: {
          "@opennextjs/cloudflare": PINNED_OPEN_NEXT_DEPENDENCY,
        },
      }),
    );

    const failures =
      loadChecker().collectCloudflareOfficialCompareFailures(rootDir);

    expect(failures).toEqual([
      expect.objectContaining({ file: "package.json" }),
    ]);
  });

  it("passes against the real repository configuration", () => {
    expect(loadChecker().collectCloudflareOfficialCompareFailures()).toEqual(
      [],
    );
  });

  it.each(["--generated-only", "--require-generated", "--unknown"])(
    "rejects unsupported argument %s",
    (argument) => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(loadChecker().runCloudflareOfficialCompareCli([argument])).toBe(
        false,
      );
      expect(error).toHaveBeenCalledWith(
        `cf-official-compare: unknown argument: ${argument}`,
      );
    },
  );
});
