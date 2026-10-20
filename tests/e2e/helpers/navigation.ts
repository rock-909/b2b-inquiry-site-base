import { expect, type Locator, type Page } from "@playwright/test";

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
 * Header mobile menu trigger (visible below desktop breakpoint).
 * Uses a stable data-testid to avoid coupling to translated labels.
 */
export function getHeaderMobileMenuButton(page: Page): Locator {
  return page.getByTestId(HEADER_MOBILE_MENU_BUTTON_TESTID).first();
}

// 语言菜单可见时，下一帧的自动聚焦可能尚未完成；方向键必须发给菜单。
export async function expectDesktopLanguageMenuKeyboardReady(
  page: Page,
): Promise<void> {
  const menu = page.getByTestId("language-dropdown-content");
  await expect(menu).toBeVisible();
  await expect
    .poll(() =>
      menu.evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true);
}
