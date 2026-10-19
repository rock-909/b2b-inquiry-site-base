import { readdirSync } from "node:fs";
import { join } from "node:path";

import type { PlaywrightTestConfig } from "@playwright/test";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

const E2E_DIR = "tests/e2e";

function collectSpecFiles(dir: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- walks the repo-local e2e directory
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) return collectSpecFiles(entryPath);
    return entry.name.endsWith(".spec.ts") ? [entryPath] : [];
  });
}

// 配置读取的全部变量都显式置值，开发者 shell 里的同名变量不会漏进用例。
const CONFIG_ENV_KEYS = [
  "CI",
  "CI_FULL_COVERAGE",
  "CI_FLAKE_SAMPLING",
  "PLAYWRIGHT_REBUILD_SERVER",
  "PLAYWRIGHT_REUSE_EXISTING_SERVER",
  "STAGING_URL",
  "PLAYWRIGHT_BASE_URL",
  "POST_DEPLOY_TEST",
] as const;

async function loadConfig(
  env: Partial<Record<(typeof CONFIG_ENV_KEYS)[number], string>>,
) {
  for (const key of CONFIG_ENV_KEYS) vi.stubEnv(key, env[key] ?? "");
  vi.resetModules();

  const { default: config } = (await import("../../playwright.config")) as {
    default: PlaywrightTestConfig;
  };

  return config;
}

function loadCiConfig(shouldRebuild: boolean) {
  return loadConfig({
    CI: "1",
    PLAYWRIGHT_REBUILD_SERVER: shouldRebuild ? "true" : "",
  });
}

function getWebServer(config: PlaywrightTestConfig) {
  if (!config.webServer || Array.isArray(config.webServer)) {
    throw new Error("Expected one local Playwright web server");
  }

  return config.webServer;
}

afterEach(() => {
  vi.resetModules();
});

// 只在整个文件结束后还原：逐用例 unstubAllEnvs 会连 setup 的桩一起清掉。
afterAll(() => {
  vi.unstubAllEnvs();
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

    expect(getWebServer(config).command).toBe(
      "pnpm build && pnpm start -H localhost",
    );
    expect(config.forbidOnly).toBe(true);
  });

  it("reuses the workflow build in ordinary CI", async () => {
    const config = await loadCiConfig(false);

    expect(getWebServer(config).command).toBe("pnpm start -H localhost");
    expect(config.forbidOnly).toBe(true);
  });

  // 测试服务器处于 Turnstile 放行模式：只能对本机开放，且不能读到真实投递密钥。
  it("keeps the test-mode server on loopback without delivery keys", async () => {
    const webServer = getWebServer(await loadCiConfig(true));

    expect(webServer.env).toMatchObject({
      RESEND_API_KEY: "",
      AIRTABLE_API_KEY: "",
    });
  });

  it("disables retries in the full browser matrix so first failures stay red", async () => {
    const config = await loadConfig({
      CI: "1",
      CI_FULL_COVERAGE: "true",
      CI_FLAKE_SAMPLING: "1",
    });

    expect(config.retries).toBe(0);
  });

  it("does not start a local server or retry for the explicit external canary", async () => {
    const config = await loadConfig({
      CI: "1",
      PLAYWRIGHT_BASE_URL: "https://preview.example.com",
      POST_DEPLOY_TEST: "1",
    });

    expect(config.webServer).toBeUndefined();
    expect(config.testIgnore).toBeUndefined();
    // 每次重试都会写一条真实询盘、发一封真实邮件。
    expect(config.retries).toBe(0);
  });
});

// 孤儿 next-server 曾占用端口 3000 超过 20 小时，本地静默复用导致三个契约
// 用例集体失败且无任何指向真实原因的线索。这三条断言把复用语义钉死。
describe("Playwright local server reuse contract", () => {
  it("defaults to not reusing an already-occupied port locally", async () => {
    const config = await loadConfig({});

    expect(getWebServer(config).reuseExistingServer).toBe(false);
  });

  it("reuses only when explicitly opted in", async () => {
    const config = await loadConfig({
      PLAYWRIGHT_REUSE_EXISTING_SERVER: "true",
    });

    expect(getWebServer(config).reuseExistingServer).toBe(true);
  });

  it("never reuses on CI even when the opt-in flag is set", async () => {
    const config = await loadConfig({
      CI: "1",
      PLAYWRIGHT_REUSE_EXISTING_SERVER: "true",
    });

    expect(getWebServer(config).reuseExistingServer).toBe(false);
  });
});
