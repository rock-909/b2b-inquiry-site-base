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
  vi.stubEnv("CI_FULL_COVERAGE", "");
  vi.stubEnv("CI_FLAKE_SAMPLING", "");
  vi.stubEnv("PLAYWRIGHT_REBUILD_SERVER", shouldRebuild ? "true" : "");
  vi.stubEnv("STAGING_URL", "");
  vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
  vi.stubEnv("POST_DEPLOY_TEST", "");
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

// 普通 E2E 自动发现所有用例，但真实 provider canary 必须显式启动。
describe("Playwright e2e discovery", () => {
  it("runs ordinary specs without the real Airtable canary", async () => {
    const config = await loadCiConfig(false);
    const specFiles = collectSpecFiles(E2E_DIR);

    expect(specFiles.length).toBeGreaterThan(0);
    expect(config.testDir).toBe(`./${E2E_DIR}`);
    expect(config.testMatch).toBeUndefined();
    expect(config.testIgnore).toEqual(/post-deploy-form\.spec\.ts$/u);
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

  it("disables retries in the full browser matrix so first failures stay red", async () => {
    vi.stubEnv("CI", "1");
    vi.stubEnv("CI_FULL_COVERAGE", "true");
    vi.stubEnv("CI_FLAKE_SAMPLING", "1");
    vi.stubEnv("PLAYWRIGHT_REBUILD_SERVER", "");
    vi.stubEnv("STAGING_URL", "");
    vi.resetModules();

    const { default: config } = (await import("../../playwright.config")) as {
      default: PlaywrightTestConfig;
    };

    expect(config.retries).toBe(0);
  });

  it("does not start a local server for the explicit external canary", async () => {
    vi.stubEnv("CI", "1");
    vi.stubEnv("STAGING_URL", "");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://preview.example.com");
    vi.stubEnv("POST_DEPLOY_TEST", "1");
    vi.resetModules();

    const { default: config } = (await import("../../playwright.config")) as {
      default: PlaywrightTestConfig;
    };

    expect(config.webServer).toBeUndefined();
    expect(config.testIgnore).toBeUndefined();
  });
});

// 孤儿 next-server 曾占用端口 3000 超过 20 小时，本地静默复用导致三个契约
// 用例集体失败且无任何指向真实原因的线索。这三条断言把复用语义钉死。
describe("Playwright local server reuse contract", () => {
  async function loadLocalConfig(reuseFlag: string) {
    vi.stubEnv("CI", "");
    vi.stubEnv("PLAYWRIGHT_REBUILD_SERVER", "");
    vi.stubEnv("STAGING_URL", "");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("POST_DEPLOY_TEST", "");
    vi.stubEnv("PLAYWRIGHT_REUSE_EXISTING_SERVER", reuseFlag);
    vi.resetModules();

    const { default: config } = (await import("../../playwright.config")) as {
      default: PlaywrightTestConfig;
    };

    return config;
  }

  it("defaults to not reusing an already-occupied port locally", async () => {
    const config = await loadLocalConfig("");

    expect(getWebServer(config).reuseExistingServer).toBe(false);
  });

  it("reuses only when explicitly opted in", async () => {
    const config = await loadLocalConfig("true");

    expect(getWebServer(config).reuseExistingServer).toBe(true);
  });

  it("never reuses on CI even when the opt-in flag is set", async () => {
    vi.stubEnv("CI", "1");
    vi.stubEnv("PLAYWRIGHT_REUSE_EXISTING_SERVER", "true");
    vi.resetModules();

    const { default: config } = (await import("../../playwright.config")) as {
      default: PlaywrightTestConfig;
    };

    expect(getWebServer(config).reuseExistingServer).toBe(false);
  });
});
