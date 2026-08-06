import { readdirSync } from "node:fs";
import { join } from "node:path";

import type { PlaywrightTestConfig } from "@playwright/test";
import { afterEach, describe, expect, it, vi } from "vitest";

const E2E_DIR = "tests/e2e";

function collectSpecFiles(dir: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- walks the repo-local e2e directory
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) return collectSpecFiles(entryPath);
    return entry.name.endsWith(".spec.ts") ? [entryPath] : [];
  });
}

async function loadCiConfig(shouldRebuild: boolean) {
  vi.stubEnv("CI", "1");
  vi.stubEnv("CI_DAILY", "");
  vi.stubEnv("CI_FLAKE_SAMPLING", "");
  vi.stubEnv("PLAYWRIGHT_PROFILE_LANE", "default");
  vi.stubEnv("PLAYWRIGHT_REBUILD_SERVER", shouldRebuild ? "true" : "");
  vi.stubEnv("STAGING_URL", "");
  vi.resetModules();

  const { default: config } = (await import("../../playwright.config")) as {
    default: PlaywrightTestConfig;
  };

  return config;
}

function getWebServer(config: PlaywrightTestConfig) {
  if (!config.webServer || Array.isArray(config.webServer)) {
    throw new Error("Expected one local Playwright web server");
  }

  return config.webServer;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

// 之前这里的门禁反过来：它把一份 5 条的 testMatch 白名单钉死，于是 14 个 e2e
// 用例文件里有 9 个从来没跑过，而门禁是绿的。现在守的是"配置不能把任何一个
// spec 文件挡在外面"——写了 e2e 就一定会执行。
describe("Playwright e2e discovery", () => {
  it("runs every spec file under the e2e directory", async () => {
    const config = await loadCiConfig(false);
    const specFiles = collectSpecFiles(E2E_DIR);

    expect(specFiles.length).toBeGreaterThan(0);
    expect(config.testDir).toBe(`./${E2E_DIR}`);
    expect(config.testMatch).toBeUndefined();
    expect(config.testIgnore).toBeUndefined();
  });
});

describe("Playwright CI web server", () => {
  it("rebuilds the release smoke server without weakening CI safeguards", async () => {
    const config = await loadCiConfig(true);

    expect(getWebServer(config).command).toBe("pnpm build && pnpm start");
    expect(config.forbidOnly).toBe(true);
    expect(config.retries).toBe(2);
    expect(config.workers).toBe(2);
  });

  it("reuses the workflow build in ordinary CI", async () => {
    const config = await loadCiConfig(false);

    expect(getWebServer(config).command).toBe("pnpm start");
    expect(config.forbidOnly).toBe(true);
    expect(config.retries).toBe(2);
    expect(config.workers).toBe(2);
  });

  it("disables retries under daily flake sampling so first failures stay red", async () => {
    vi.stubEnv("CI", "1");
    vi.stubEnv("CI_DAILY", "true");
    vi.stubEnv("CI_FLAKE_SAMPLING", "1");
    vi.stubEnv("PLAYWRIGHT_PROFILE_LANE", "all");
    vi.stubEnv("PLAYWRIGHT_REBUILD_SERVER", "");
    vi.stubEnv("STAGING_URL", "");
    vi.resetModules();

    const { default: config } = (await import("../../playwright.config")) as {
      default: PlaywrightTestConfig;
    };

    expect(config.retries).toBe(0);
  });
});
