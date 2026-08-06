import type { Page } from "@playwright/test";

/**
 * 测试环境设置
 *
 * 专门为 E2E 测试配置环境，确保测试工具之间不会相互干扰
 */

/**
 * 禁用开发工具的环境变量设置
 */
const TEST_ENV_VARS = {
  // 设置测试环境标识
  NODE_ENV: "test",
  PLAYWRIGHT_TEST: "true",

  // 禁用可能干扰测试的监控工具
  NEXT_PUBLIC_DISABLE_PERFORMANCE_MONITOR: "true",

  // 测试专用配置
  NEXT_PUBLIC_TEST_MODE: "true",
} as const;

/**
 * 为测试环境配置环境变量
 */
export function setupTestEnvironment() {
  console.log("🧪 Setting up test environment...");

  // 设置测试环境变量
  Object.entries(TEST_ENV_VARS).forEach(([key, value]) => {
    process.env[key] = value;
    console.log(`   ${key}=${value}`);
  });

  console.log("✅ Test environment configured");
}

/**
 * 清理测试环境
 */
export function cleanupTestEnvironment() {
  console.log("🧹 Cleaning up test environment...");

  // 清理测试环境变量（可选）
  Object.keys(TEST_ENV_VARS).forEach((key) => {
    delete process.env[key];
  });

  console.log("✅ Test environment cleaned up");
}

interface WaitForLoadOptions {
  loadTimeout?: number;
  fallbackDelay?: number;
  context?: string;
}

/**
 * 等待页面 load 状态，若超时则降级为短暂延时，避免 networkidle 阻塞
 */
export async function waitForLoadWithFallback(
  page: Page,
  options: WaitForLoadOptions = {},
) {
  const { loadTimeout = 5_000, fallbackDelay = 1_000, context } = options;

  try {
    await page.waitForLoadState("load", { timeout: loadTimeout });
  } catch (error) {
    console.warn(
      `⚠️ waitForLoadState("load") timed out${
        context ? ` (${context})` : ""
      }, falling back to ${fallbackDelay}ms delay`,
      error instanceof Error ? error.message : error,
    );
    await page.waitForTimeout(fallbackDelay);
  }
}

/**
 * Close the cookie banner in flows where it is not the behavior under test.
 */
export async function acceptCookieBannerIfVisible(page: Page): Promise<void> {
  const cookieDialog = page.getByRole("dialog", { name: /cookie/i });

  if (!(await cookieDialog.isVisible({ timeout: 3_000 }).catch(() => false))) {
    return;
  }

  const acceptButton = cookieDialog.getByRole("button", {
    name: /accept|全部接受/i,
  });

  if (!(await acceptButton.isVisible({ timeout: 2_000 }).catch(() => false))) {
    return;
  }

  await acceptButton.click();
  await cookieDialog.waitFor({ state: "hidden", timeout: 5_000 });
}
