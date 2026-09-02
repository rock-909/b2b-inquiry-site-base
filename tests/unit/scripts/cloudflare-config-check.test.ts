import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { moveOwnedTempDirectoryToTrash } from "@/test/temp-fixture";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const SCRIPT_PATH = path.join(
  REPO_ROOT,
  "scripts/quality/checks/cloudflare-config-check.js",
);
const FIXTURE_PREFIX = "b2b-inquiry-cloudflare-config-";
const requireModule = createRequire(path.join(REPO_ROOT, "package.json"));
const tempDirs: string[] = [];
const CANONICAL_CLOUDFLARE_BUILD_SCRIPTS = {
  "website:build:cf":
    "DEPLOYMENT_PLATFORM=cloudflare NEXT_PUBLIC_DEPLOYMENT_PLATFORM=cloudflare pnpm exec opennextjs-cloudflare build",
  "website:build:cf:debug":
    "DEPLOYMENT_PLATFORM=cloudflare NEXT_PUBLIC_DEPLOYMENT_PLATFORM=cloudflare pnpm exec opennextjs-cloudflare build --noMinify",
};
const STABLE_OPEN_NEXT_DEPENDENCY = "1.20.6";
const PREVIEW_R2_BUCKET = "derived-site-next-cache-preview";
const PRODUCTION_R2_BUCKET = "derived-site-next-cache-production";

interface Failure {
  readonly file: string;
  readonly missing: readonly string[];
  readonly forbidden: readonly string[];
}
interface CloudflareConfigCheckModule {
  readonly collectCloudflareConfigFailures: (rootDir?: string) => Failure[];
  readonly runCloudflareConfigCheckCli: () => boolean;
}

function loadChecker(): CloudflareConfigCheckModule {
  return requireModule(SCRIPT_PATH) as CloudflareConfigCheckModule;
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
        "@opennextjs/cloudflare": STABLE_OPEN_NEXT_DEPENDENCY,
      },
    }),
  );
}

function writePassingWranglerConfig(
  rootDir: string,
  bucketNames: { preview?: string; production?: string } = {},
): void {
  const previewBucket = bucketNames.preview ?? PREVIEW_R2_BUCKET;
  const productionBucket = bucketNames.production ?? PRODUCTION_R2_BUCKET;
  writeFixtureFile(
    rootDir,
    "wrangler.jsonc",
    [
      "{",
      '  "main": "open-next-worker.js",',
      '  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],',
      '  "assets": { "binding": "ASSETS" },',
      '  "env": {',
      `    "preview": { "r2_buckets": [{ "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "${previewBucket}" }] },`,
      `    "production": { "r2_buckets": [{ "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "${productionBucket}" }] }`,
      "  }",
      "}",
    ].join("\n"),
  );
}

function createFixture(): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), FIXTURE_PREFIX));
  tempDirs.push(rootDir);
  return rootDir;
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    moveOwnedTempDirectoryToTrash(tempDir, FIXTURE_PREFIX);
  }
});

describe("Cloudflare config source contract", () => {
  it("rejects required config that appears only in comments", () => {
    const rootDir = createFixture();
    writePassingSideFiles(rootDir);
    // Required wrangler values present only in a comment must NOT satisfy.
    writeFixtureFile(
      rootDir,
      "wrangler.jsonc",
      [
        "{",
        '  // "main": "open-next-worker.js", "binding": "ASSETS",',
        '  // "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"]',
        '  "name": "fixture"',
        "}",
      ].join("\n"),
    );
    const failures = loadChecker().collectCloudflareConfigFailures(rootDir);

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
        '  "main": "open-next-worker.js",',
        '  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],',
        "  // historical note: r2_buckets and d1_databases were never added",
        '  "assets": { "binding": "ASSETS" },',
        '  "env": {',
        `    "preview": { "r2_buckets": [{ "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "${PREVIEW_R2_BUCKET}" }] },`,
        `    "production": { "r2_buckets": [{ "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "${PRODUCTION_R2_BUCKET}" }] }`,
        "  }",
        "}",
      ].join("\n"),
    );

    const failures = loadChecker().collectCloudflareConfigFailures(rootDir);

    expect(failures).toEqual([]);
  });

  it("accepts the canonical Cloudflare build script surface", () => {
    const rootDir = createFixture();
    writePassingSideFiles(rootDir);
    writePassingWranglerConfig(rootDir);

    const failures = loadChecker().collectCloudflareConfigFailures(rootDir);

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

    const failures = loadChecker().collectCloudflareConfigFailures(rootDir);

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

    const failures = loadChecker().collectCloudflareConfigFailures(rootDir);

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
        '  "main": "open-next-worker.js",',
        '  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],',
        '  "assets": { "binding": "ASSETS" },',
        '  "env": {',
        `    "preview": { "r2_buckets": [{ "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "${PREVIEW_R2_BUCKET}" }] }`,
        "  }",
        "}",
      ].join("\n"),
    );

    const failures = loadChecker().collectCloudflareConfigFailures(rootDir);

    expect(failures).toEqual([
      expect.objectContaining({
        file: "wrangler.jsonc",
        missing: expect.arrayContaining([
          expect.stringContaining("env.production.r2_buckets"),
        ]),
      }),
    ]);
  });

  it("rejects an empty R2 bucket name", () => {
    const rootDir = createFixture();
    writePassingSideFiles(rootDir);
    writePassingWranglerConfig(rootDir, { preview: "" });

    const failures = loadChecker().collectCloudflareConfigFailures(rootDir);

    expect(failures).toEqual([
      expect.objectContaining({
        file: "wrangler.jsonc",
        missing: expect.arrayContaining([
          expect.stringContaining("non-empty bucket_name"),
        ]),
      }),
    ]);
  });

  it("rejects one R2 bucket shared by preview and production", () => {
    const rootDir = createFixture();
    writePassingSideFiles(rootDir);
    writePassingWranglerConfig(rootDir, {
      production: PREVIEW_R2_BUCKET,
    });

    const failures = loadChecker().collectCloudflareConfigFailures(rootDir);

    expect(failures).toEqual([
      expect.objectContaining({
        file: "wrangler.jsonc",
        missing: expect.arrayContaining([
          expect.stringContaining("different bucket_name values"),
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

    const failures = loadChecker().collectCloudflareConfigFailures(rootDir);

    expect(failures).toEqual([
      expect.objectContaining({
        file: "package.json",
        missing: [`@opennextjs/cloudflare: ${STABLE_OPEN_NEXT_DEPENDENCY}`],
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
          "@opennextjs/cloudflare": STABLE_OPEN_NEXT_DEPENDENCY,
        },
      }),
    );

    const failures = loadChecker().collectCloudflareConfigFailures(rootDir);

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
          "@opennextjs/cloudflare": STABLE_OPEN_NEXT_DEPENDENCY,
        },
      }),
    );

    const failures = loadChecker().collectCloudflareConfigFailures(rootDir);

    expect(failures).toEqual([
      expect.objectContaining({ file: "package.json" }),
    ]);
  });

  describe("open-next wiring harness", () => {
    function writeWiredConfig(rootDir: string, body: readonly string[]) {
      writePassingSideFiles(rootDir);
      writeFixtureFile(rootDir, "open-next.config.ts", body.join("\n"));
      writePassingWranglerConfig(rootDir);
    }

    it("rejects multiple defineCloudflareConfig calls", () => {
      const rootDir = createFixture();
      writePassingSideFiles(rootDir);
      writePassingWranglerConfig(rootDir);
      writeFixtureFile(
        rootDir,
        "open-next.config.ts",
        [
          'import { defineCloudflareConfig } from "@opennextjs/cloudflare";',
          'import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";',
          "export default defineCloudflareConfig({ incrementalCache: r2IncrementalCache });",
          "export const second = defineCloudflareConfig({ incrementalCache: r2IncrementalCache });",
          "",
        ].join("\n"),
      );

      const failures = loadChecker().collectCloudflareConfigFailures(rootDir);

      expect(failures).toEqual([
        expect.objectContaining({
          file: "open-next.config.ts",
          missing: expect.arrayContaining([
            "incrementalCache: r2IncrementalCache",
          ]),
        }),
      ]);
    });

    it("rejects an extra config key alongside the R2 wiring", () => {
      const rootDir = createFixture();
      writePassingWranglerConfig(rootDir);
      writeWiredConfig(rootDir, [
        'import { defineCloudflareConfig } from "@opennextjs/cloudflare";',
        'import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";',
        "const somethingElse = {};",
        "export default defineCloudflareConfig({ incrementalCache: r2IncrementalCache, queue: somethingElse });",
        "",
      ]);

      const failures = loadChecker().collectCloudflareConfigFailures(rootDir);

      expect(failures).toEqual([
        expect.objectContaining({
          file: "open-next.config.ts",
          missing: expect.arrayContaining([
            "incrementalCache: r2IncrementalCache",
          ]),
        }),
      ]);
    });

    it("rejects a non-sentinel incremental cache value", () => {
      const rootDir = createFixture();
      writePassingWranglerConfig(rootDir);
      writeWiredConfig(rootDir, [
        'import { defineCloudflareConfig } from "@opennextjs/cloudflare";',
        "const myOwnCache = {};",
        "export default defineCloudflareConfig({ incrementalCache: myOwnCache });",
        "",
      ]);

      const failures = loadChecker().collectCloudflareConfigFailures(rootDir);

      expect(failures).toEqual([
        expect.objectContaining({
          file: "open-next.config.ts",
          missing: expect.arrayContaining([
            "incrementalCache: r2IncrementalCache",
          ]),
        }),
      ]);
    });

    it("rejects an export that is not the defineCloudflareConfig result", () => {
      const rootDir = createFixture();
      writePassingWranglerConfig(rootDir);
      writeWiredConfig(rootDir, [
        'import { defineCloudflareConfig } from "@opennextjs/cloudflare";',
        'import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";',
        "const config = defineCloudflareConfig({ incrementalCache: r2IncrementalCache });",
        "export default { ...config };",
        "",
      ]);

      const failures = loadChecker().collectCloudflareConfigFailures(rootDir);

      expect(failures).toEqual([
        expect.objectContaining({
          file: "open-next.config.ts",
          missing: expect.arrayContaining([
            "exported default must be the object returned by defineCloudflareConfig",
          ]),
        }),
      ]);
    });

    it("rejects a mutated override carrying an extra key", () => {
      const rootDir = createFixture();
      writePassingWranglerConfig(rootDir);
      writeWiredConfig(rootDir, [
        'import { defineCloudflareConfig } from "@opennextjs/cloudflare";',
        'import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";',
        "const config = defineCloudflareConfig({ incrementalCache: r2IncrementalCache });",
        'config.default.override.tagCache = "somethingUnexpected";',
        "export default config;",
        "",
      ]);

      const failures = loadChecker().collectCloudflareConfigFailures(rootDir);

      expect(failures).toEqual([
        expect.objectContaining({
          file: "open-next.config.ts",
          missing: expect.arrayContaining([
            "incrementalCache: r2IncrementalCache",
          ]),
        }),
      ]);
    });

    it("rejects a non-object defineCloudflareConfig argument", () => {
      const rootDir = createFixture();
      writePassingSideFiles(rootDir);
      writePassingWranglerConfig(rootDir);
      writeFixtureFile(
        rootDir,
        "open-next.config.ts",
        [
          'import { defineCloudflareConfig } from "@opennextjs/cloudflare";',
          "export default defineCloudflareConfig(null);",
          "",
        ].join("\n"),
      );

      const failures = loadChecker().collectCloudflareConfigFailures(rootDir);

      expect(failures).toEqual([
        expect.objectContaining({
          file: "open-next.config.ts",
          missing: expect.arrayContaining([
            "incrementalCache: r2IncrementalCache",
          ]),
        }),
      ]);
    });

    it("does not trip on donor forbidden tokens inside comments or longer identifiers", () => {
      const rootDir = createFixture();
      writePassingWranglerConfig(rootDir);
      writeWiredConfig(rootDir, [
        "// historical note: apiLead, apiOps and /api/cache/invalidate were never wired here",
        'const myapiLeadNote = "mentions /api/cache/invalidation in prose";',
        'import { defineCloudflareConfig } from "@opennextjs/cloudflare";',
        'import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";',
        "export default defineCloudflareConfig({ incrementalCache: r2IncrementalCache });",
        "void myapiLeadNote;",
        "",
      ]);

      expect(loadChecker().collectCloudflareConfigFailures(rootDir)).toEqual(
        [],
      );
    });
  });

  it("passes against the real repository configuration", () => {
    expect(loadChecker().collectCloudflareConfigFailures()).toEqual([]);
  });
});
