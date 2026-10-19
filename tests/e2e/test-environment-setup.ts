import type { Page } from "@playwright/test";
import { DEFAULT_LOCALE, getLocaleMessages } from "./site-page-cases";

/**
 * 收集未捕获异常和 console.error。CSP 拦截、资源加载失败只出现在 console 里，
 * 只听 pageerror 会漏掉它们。
 */
export function collectBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console.error: ${message.text()}`);
    }
  });
  return errors;
}

/**
 * Close the cookie banner in flows where it is not the behavior under test.
 * 横幅只在配置了 GA 时、水合后才出现，所以注册遮挡处理器而不是只查一次；
 * 调用方只访问默认语种页面。
 */
export async function acceptCookieBannerIfVisible(page: Page): Promise<void> {
  const { cookie } = getLocaleMessages(DEFAULT_LOCALE);
  const banner = page.getByRole("region", { name: cookie.title });

  await page.addLocatorHandler(banner, async () => {
    await banner.getByRole("button", { name: cookie.acceptAll }).click();
  });
}
