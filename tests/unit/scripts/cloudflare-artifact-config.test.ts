import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const SCRIPT_PATH = path.join(
  REPO_ROOT,
  "scripts/quality/checks/cloudflare-artifact-config.js",
);
const FIXTURE_PREFIX = "b2b-inquiry-cloudflare-artifact-config-";
const requireModule = createRequire(path.join(REPO_ROOT, "package.json"));

interface CloudflareArtifactConfigModule {
  readonly verifyCloudflareArtifactConfig: (rootDir?: string) => string[];
  readonly verifyStaticAssetsCachePopulated: (rootDir?: string) => string[];
}

function loadChecker(): CloudflareArtifactConfigModule {
  return requireModule(SCRIPT_PATH) as CloudflareArtifactConfigModule;
}

function createFixture(): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), FIXTURE_PREFIX));
  return rootDir;
}

function writeArtifact(
  rootDir: string,
  relativePath: string,
  config: Record<string, unknown>,
): void {
  const artifactPath = path.join(rootDir, relativePath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- writes a test-owned fixture under a temp root
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- writes a test-owned fixture under a temp root
  fs.writeFileSync(artifactPath, JSON.stringify({ config }));
}

function writeValidArtifacts(rootDir: string): void {
  const config = {
    productionBrowserSourceMaps: false,
    images: { unoptimized: true },
  };

  writeArtifact(rootDir, ".next/required-server-files.json", config);
  writeArtifact(
    rootDir,
    ".open-next/server-functions/default/.next/required-server-files.json",
    config,
  );
}

function writeCacheFile(
  rootDir: string,
  baseDir: string,
  relativePath: string,
  content = "{}",
): void {
  const filePath = path.join(rootDir, baseDir, relativePath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- writes a test-owned fixture under a temp root
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- writes a test-owned fixture under a temp root
  fs.writeFileSync(filePath, content);
}

const BUILD_CACHE = ".open-next/cache";
const STATIC_ASSETS_CACHE = ".open-next/assets/cdn-cgi/_next_cache";

describe("Cloudflare artifact config proof", () => {
  it("accepts canonical Next and OpenNext required-server-files configs", () => {
    const rootDir = createFixture();
    writeValidArtifacts(rootDir);

    const artifactPaths = loadChecker().verifyCloudflareArtifactConfig(rootDir);

    expect(artifactPaths).toEqual([
      ".next/required-server-files.json",
      ".open-next/server-functions/default/.next/required-server-files.json",
    ]);
  });

  it("rejects a missing artifact family", () => {
    const rootDir = createFixture();
    writeArtifact(rootDir, ".next/required-server-files.json", {
      productionBrowserSourceMaps: false,
      images: { unoptimized: true },
    });

    expect(() => loadChecker().verifyCloudflareArtifactConfig(rootDir)).toThrow(
      ".open-next/**/.next/required-server-files.json",
    );
  });

  // 每行只坏一个字段，证明两项检查各自生效。
  it.each([
    [
      { productionBrowserSourceMaps: true, images: { unoptimized: true } },
      "productionBrowserSourceMaps must be false",
    ],
    [
      { productionBrowserSourceMaps: false, images: { unoptimized: false } },
      "images.unoptimized must be true",
    ],
  ])("rejects non-canonical generated config %j", (config, message) => {
    const rootDir = createFixture();
    writeValidArtifacts(rootDir);
    writeArtifact(rootDir, ".next/required-server-files.json", config);

    expect(() => loadChecker().verifyCloudflareArtifactConfig(rootDir)).toThrow(
      message,
    );
  });

  it("exits nonzero when the CLI proof fails", () => {
    const rootDir = createFixture();

    const result = spawnSync(process.execPath, [SCRIPT_PATH], {
      cwd: rootDir,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Cloudflare artifact config check failed");
  });

  describe("Static Assets cache population", () => {
    it("accepts a build whose prerendered cache was copied to Static Assets", () => {
      const rootDir = createFixture();
      writeCacheFile(rootDir, BUILD_CACHE, "build-id/index.cache");
      writeCacheFile(rootDir, BUILD_CACHE, "__fetch/build-id/key");
      writeCacheFile(rootDir, STATIC_ASSETS_CACHE, "build-id/index.cache");
      writeCacheFile(rootDir, STATIC_ASSETS_CACHE, "__fetch/build-id/key");

      expect(
        loadChecker().verifyStaticAssetsCachePopulated(rootDir).sort(),
      ).toEqual(["__fetch/build-id/key", "build-id/index.cache"]);
    });

    it("rejects an unpopulated artifact and exits nonzero from the CLI", () => {
      const rootDir = createFixture();
      writeCacheFile(rootDir, BUILD_CACHE, "build-id/index.cache");

      expect(() =>
        loadChecker().verifyStaticAssetsCachePopulated(rootDir),
      ).toThrow("missing 1 of 1 prerendered cache entries");

      const result = spawnSync(
        process.execPath,
        [SCRIPT_PATH, "--static-assets-cache"],
        { cwd: rootDir, encoding: "utf8" },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("populateCache");
    });

    it("rejects a partially populated artifact", () => {
      const rootDir = createFixture();
      writeCacheFile(rootDir, BUILD_CACHE, "build-id/index.cache");
      writeCacheFile(rootDir, BUILD_CACHE, "build-id/contact.cache");
      writeCacheFile(rootDir, STATIC_ASSETS_CACHE, "build-id/index.cache");

      expect(() =>
        loadChecker().verifyStaticAssetsCachePopulated(rootDir),
      ).toThrow("missing 1 of 2 prerendered cache entries");
    });

    it.each([
      [
        "a directory",
        (rootDir: string) => {
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- writes a test-owned fixture under a temp root
          fs.mkdirSync(
            path.join(rootDir, STATIC_ASSETS_CACHE, "build-id/index.cache"),
            { recursive: true },
          );
        },
      ],
      [
        "a zero-byte file",
        (rootDir: string) =>
          writeCacheFile(
            rootDir,
            STATIC_ASSETS_CACHE,
            "build-id/index.cache",
            "",
          ),
      ],
      [
        "a file with different content",
        (rootDir: string) =>
          writeCacheFile(
            rootDir,
            STATIC_ASSETS_CACHE,
            "build-id/index.cache",
            '{"stale":true}',
          ),
      ],
    ])("rejects a target that is %s", (_label, writeTarget) => {
      const rootDir = createFixture();
      writeCacheFile(
        rootDir,
        BUILD_CACHE,
        "build-id/index.cache",
        '{"page":1}',
      );
      writeTarget(rootDir);

      expect(() =>
        loadChecker().verifyStaticAssetsCachePopulated(rootDir),
      ).toThrow("missing 1 of 1 prerendered cache entries");
    });

    it("rejects a build with no prerendered cache entries", () => {
      const rootDir = createFixture();

      expect(() =>
        loadChecker().verifyStaticAssetsCachePopulated(rootDir),
      ).toThrow("No prerendered cache entries");
    });
  });
});
