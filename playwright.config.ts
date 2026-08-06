import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// 加载测试环境配置（loadEnvFile 对缺失文件会抛错，所以先判存在）
if (existsSync(".env.test")) {
  process.loadEnvFile(".env.test");
}

/**
 * @see https://playwright.dev/docs/test-configuration
 */
const isCI = Boolean(process.env.CI);
const isDaily = process.env.CI_DAILY === "true";
const shouldRebuildServer = process.env.PLAYWRIGHT_REBUILD_SERVER === "true";
const PLAYWRIGHT_PROFILE_LANE_IDS = new Set(["default", "optional", "all"]);

function normalizePlaywrightProfileLane(rawValue: string | undefined) {
  const normalized = rawValue?.trim() || "default";
  if (!PLAYWRIGHT_PROFILE_LANE_IDS.has(normalized)) {
    throw new Error(
      `Unknown PLAYWRIGHT_PROFILE_LANE: ${normalized}. Allowed: default, optional, all`,
    );
  }
  return normalized;
}

const profileLane = normalizePlaywrightProfileLane(
  process.env.PLAYWRIGHT_PROFILE_LANE,
);
const defaultGrepInvertPatterns = [
  ...(isCI && !isDaily ? [/debug|diagnosis/i] : []),
  ...(profileLane === "default" ? [/@profile:/i] : []),
];
const resolvedBaseUrl =
  process.env.STAGING_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  "http://localhost:3000";

// HTML reporter may start a local server and wait for Ctrl+C when open is enabled.
// In non-interactive runners (e.g. ClaudeCode/CI logs), this causes the process to hang.
const isInteractiveTerminal = Boolean(
  process.stdout.isTTY && process.stdin.isTTY,
);
const htmlReportOpen: "always" | "never" | "on-failure" =
  isCI || !isInteractiveTerminal ? "never" : "on-failure";

// 基于是否为每日全量任务，动态裁剪浏览器矩阵，加速常规CI
const baseProjects = [
  {
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
  },
];

const extendedProjects = [
  {
    name: "firefox",
    use: { ...devices["Desktop Firefox"] },
  },
  {
    name: "webkit",
    use: { ...devices["Desktop Safari"] },
  },
  {
    name: "Mobile Chrome",
    use: { ...devices["Pixel 5"] },
  },
  {
    name: "Mobile Safari",
    use: { ...devices["iPhone 12"] },
  },
];

export default defineConfig({
  // 不写 testMatch：testDir 下所有 *.spec.ts 一律跑。之前是一份 5 条的白名单，
  // 结果 14 个用例文件里有 9 个从来没被执行过——新写的 e2e 不加进白名单就等于没写。
  testDir: "./tests/e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: Boolean(process.env.CI),
  /* Retry on CI only */
  retries: process.env.CI ? (process.env.CI_FLAKE_SAMPLING === "1" ? 0 : 2) : 0,
  /* Opt out of parallel tests on CI. */
  // CI 上启用 2 个并发以降低整体时长；本地保持 4
  workers: isCI ? 2 : 4,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    [
      "html",
      { outputFolder: "reports/playwright-report", open: htmlReportOpen },
    ],
    ["json", { outputFile: "reports/playwright-results.json" }],
    ["junit", { outputFile: "reports/playwright-results.xml" }],
  ],
  // 非每日任务时，排除调试/诊断类用例，进一步收敛耗时
  ...(defaultGrepInvertPatterns.length > 0
    ? { grepInvert: defaultGrepInvertPatterns }
    : {}),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: resolvedBaseUrl,

    // 控制动作/导航等待上限，避免无界等待导致整体卡时
    // Increased for CI environment stability (GitHub Actions can be slower)
    actionTimeout: 10_000,
    navigationTimeout: 30_000,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Take screenshot on failure */
    screenshot: "only-on-failure",

    /* Record video on failure */
    video: "retain-on-failure",
  },

  /* Configure projects for major browsers */
  projects: isDaily ? [...baseProjects, ...extendedProjects] : baseProjects,

  /* Run your local dev server before starting the tests */
  // 如果设置了 STAGING_URL，跳过本地服务器
  ...(process.env.STAGING_URL
    ? {}
    : {
        webServer: {
          // 统一使用生产模式运行 E2E 测试,消除开发模式的 Hydration mismatch 警告
          // 注意：必须使用 NODE_ENV=production 进行构建，否则 React 19 的某些内部 API
          // （如 captureOwnerStack）在 test 模式下不可用，会导致 sitemap.ts 预渲染失败
          // CI 默认复用 workflow build；release proof 用专用 flag 按 test-mode env 重建
          command:
            isCI && !shouldRebuildServer
              ? "pnpm start"
              : "pnpm build && pnpm start",
          url: "http://localhost:3000",
          reuseExistingServer: !process.env.CI,
          timeout: process.env.CI ? 60 * 1000 : 180 * 1000, // CI已构建,启动更快
          // [local/test-mode] Local E2E proof boundary: this webServer uses test-mode services for stable smoke coverage.
          // It proves local rendering and interaction only, not real Turnstile or deployed lead proof.
          // NODE_ENV 必须为 production 以确保 React 19 正常工作
          env: {
            NODE_ENV: "production",
            PLAYWRIGHT_TEST: "true",
            NEXT_PUBLIC_TEST_MODE: "true",
            NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
            NEXT_PUBLIC_SITE_URL: "http://localhost:3000",

            // Turnstile test keys (always pass mode)
            // See: https://developers.cloudflare.com/turnstile/reference/testing/
            NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
            TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",

            NEXT_PUBLIC_SECURITY_MODE: "relaxed",
            SECURITY_HEADERS_ENABLED: "false",
            SKIP_ENV_VALIDATION: "true",
            APP_ENV: "preview",
            // Turnstile 的测试模式读的是 NEXT_PUBLIC_APP_ENV。只设 APP_ENV 时，
            // NODE_ENV=production 会让 isTestMode 判成 false，渲染真实控件而不是
            // 测试占位——等待 turnstile-mock 的用例因此全部超时。
            NEXT_PUBLIC_APP_ENV: "preview",
          },
        },
      }),

  /* Global setup and teardown */
  globalSetup: require.resolve("./tests/e2e/global-setup.ts"),
  globalTeardown: require.resolve("./tests/e2e/global-teardown.ts"),

  /* Test timeout */
  timeout: 30 * 1000,
  expect: {
    // Increase expect timeout on CI (helps Firefox/Mobile reduce flakes)
    timeout: process.env.CI ? 8 * 1000 : 5 * 1000,
  },

  /* Output directory for test artifacts */
  outputDir: "test-results/",
});
