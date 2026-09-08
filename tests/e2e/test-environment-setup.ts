import type { Page } from "@playwright/test";

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
