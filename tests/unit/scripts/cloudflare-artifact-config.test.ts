import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const SCRIPT_PATH = path.join(
  REPO_ROOT,
  "scripts/quality/checks/cloudflare-artifact-config.js",
);
const TEST_TRASH_DIR = path.join(
  os.tmpdir(),
  "tucsenberg-cloudflare-artifact-config-test-trash",
);
const requireModule = createRequire(path.join(REPO_ROOT, "package.json"));
const tempDirs: string[] = [];

interface CloudflareArtifactConfigModule {
  readonly verifyCloudflareArtifactConfig: (rootDir?: string) => string[];
}

function loadChecker(): CloudflareArtifactConfigModule {
  expect(fs.existsSync(SCRIPT_PATH), "checked-in artifact proof").toBe(true);
  return requireModule(SCRIPT_PATH) as CloudflareArtifactConfigModule;
}

function createFixture(): string {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "tucsenberg-cloudflare-artifact-config-"),
  );
  tempDirs.push(rootDir);
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

function moveFixtureToTrash(rootDir: string): void {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- creates the test-owned temp trash root
  fs.mkdirSync(TEST_TRASH_DIR, { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- cleanup moves a test-owned fixture to recoverable temp trash
  fs.renameSync(rootDir, path.join(TEST_TRASH_DIR, path.basename(rootDir)));
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    moveFixtureToTrash(tempDir);
  }
});

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

  it("rejects non-canonical generated config", () => {
    const rootDir = createFixture();
    writeValidArtifacts(rootDir);
    writeArtifact(rootDir, ".next/required-server-files.json", {
      productionBrowserSourceMaps: true,
      images: { unoptimized: false },
    });

    expect(() => loadChecker().verifyCloudflareArtifactConfig(rootDir)).toThrow(
      "productionBrowserSourceMaps must be false",
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
});
