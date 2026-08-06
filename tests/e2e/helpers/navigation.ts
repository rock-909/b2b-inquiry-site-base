import { expect, type Locator, type Page } from "@playwright/test";

const MAIN_NAV_ROLE_OPTIONS = {
  name: /main navigation/i,
} as const;

export const MAIN_NAV_SELECTOR = 'nav[aria-label="Main navigation"]';
export const MOBILE_MENU_CONTENT_SELECTOR =
  '[data-testid="mobile-menu-content"]';

const HEADER_MOBILE_MENU_BUTTON_TESTID = "header-mobile-menu-button";

/**
 * Wait for the rendered html[lang] attribute to match the expected locale.
 */
export async function waitForHtmlLang(
  page: Page,
  expectedLang: string,
  timeout = process.env.CI ? 8000 : 10000,
): Promise<void> {
  await page.waitForFunction(
    (lang) => document.documentElement.lang === lang,
    expectedLang,
    { timeout },
  );
}

/**
 * Assert html[lang] after waiting for navigation/render to settle.
 */
export async function expectHtmlLang(
  page: Page,
  expectedLang: string,
): Promise<void> {
  await waitForHtmlLang(page, expectedLang);
  await expect(page.locator("html")).toHaveAttribute("lang", expectedLang);
}

/**
 * 获取主导航栏定位器，针对桌面/移动场景自动回退
 */
export function getNav(page: Page): Locator {
  const nav = page.getByRole("navigation", MAIN_NAV_ROLE_OPTIONS);
  return nav.first();
}

/**
 * Header mobile menu trigger (visible below desktop breakpoint).
 * Uses a stable data-testid to avoid coupling to translated labels.
 */
export function getHeaderMobileMenuButton(page: Page): Locator {
  return page.getByTestId(HEADER_MOBILE_MENU_BUTTON_TESTID).first();
}

/**
 * Determine whether the header is currently in "mobile/tablet" mode
 * based on which controls are actually visible.
 *
 * This avoids hardcoding breakpoint numbers in tests.
 */
export async function isHeaderInMobileMode(page: Page): Promise<boolean> {
  const button = getHeaderMobileMenuButton(page);
  try {
    return await button.isVisible();
  } catch {
    return false;
  }
}

/**
 * 点击主导航栏中的指定链接。
 * @param page Playwright 页面实例
 * @param linkName 可访问名称（会处理英文/本地化文案）
 */
export async function clickNavLinkByName(
  page: Page,
  linkName: string,
): Promise<void> {
  const nav = getNav(page);
  const link = nav.getByRole("link", { name: linkName });
  await link.click();
}
