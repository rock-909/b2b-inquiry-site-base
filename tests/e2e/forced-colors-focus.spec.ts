import { expect, test, type Locator } from "@playwright/test";
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import {
  expectDesktopLanguageMenuKeyboardReady,
  getHeaderMobileMenuButton,
} from "./helpers/navigation";
import {
  DEFAULT_LOCALE,
  getLocaleMessages,
  localizePath,
  SECOND_LOCALE,
} from "./site-page-cases";
import { acceptCookieBannerIfVisible } from "./test-environment-setup";

// Windows 高对比度（forced-colors）下 box-shadow 会被系统去掉，Tailwind 的
// `outline-none` 又只输出 `outline-style: none`，键盘焦点和菜单高亮会完全不可见。
// 这里只证明买家按 Tab / 方向键时，真实页面上的焦点指示仍然是可见的 outline。
test.use({ colorScheme: "light" });

const visibleOutline = async (locator: Locator) =>
  locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
    };
  });

// 普通配色下输入框同样必须走全局 2px 焦点轮廓：曾因 outline-none 加失效的 ring 导致焦点完全不可见。
test("keyboard-focused inquiry input shows the global focus outline", async ({
  page,
}) => {
  const response = await page.goto("/contact", {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(200);
  await acceptCookieBannerIfVisible(page);

  const fullName = page.getByLabel(/^full name/i);
  await expect(fullName).toBeEditable({ timeout: 15_000 });

  // 只用真实 Tab 键到达姓名字段；超过上限仍未到达即失败。
  const maxTabPresses = 30;
  for (let i = 0; i < maxTabPresses; i += 1) {
    if (
      await fullName.evaluate((element) => element === document.activeElement)
    ) {
      break;
    }
    await page.keyboard.press("Tab");
  }
  await expect(fullName).toBeFocused();

  const outline = await visibleOutline(fullName);
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThanOrEqual(2);
});

test.describe("forced-colors keyboard indicators", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    const response = await page.goto("/contact", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(200);
    await acceptCookieBannerIfVisible(page);
  });

  test("keyboard-focused inquiry input keeps a visible outline", async ({
    page,
  }) => {
    const fullName = page.getByLabel(/^full name/i);
    await expect(fullName).toBeEditable({ timeout: 15_000 });

    // 先按一次键盘进入键盘模态，focus() 才会命中 :focus-visible。
    await page.keyboard.press("Tab");
    await fullName.focus();
    await expect(fullName).toBeFocused();

    const outline = await visibleOutline(fullName);
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThan(0);
  });

  test("language choice keeps a visible keyboard indicator", async ({
    page,
    browserName,
  }) => {
    test.skip(SECOND_LOCALE === undefined, "单语种站点不渲染语言切换");
    // 跳过后不会执行，回退值只为让类型收窄。
    const second = SECOND_LOCALE ?? DEFAULT_LOCALE;
    const mobileMenuButton = getHeaderMobileMenuButton(page);
    if (await mobileMenuButton.isVisible()) {
      // 手机使用抽屉内的原生 details 和链接，不存在桌面菜单的高亮状态。
      await mobileMenuButton.click();
      const drawer = page.getByRole("dialog", {
        name: getLocaleMessages(DEFAULT_LOCALE).accessibility.mobileNavigation,
      });
      await expect(drawer).toBeVisible();
      const languageTrigger = drawer.getByTestId("mobile-language-trigger");
      await languageTrigger.focus();
      await expect(languageTrigger).toBeFocused();
      await page.keyboard.press("Enter");

      const secondLocale = drawer.getByRole("link", {
        name: LOCALES_CONFIG.displayNames[second],
      });
      await expect(secondLocale).toBeVisible();
      // macOS Safari 默认用 Option-Tab 访问链接；普通 Tab 会跳过链接。
      const nextLinkKey =
        browserName === "webkit" && process.platform === "darwin"
          ? "Alt+Tab"
          : "Tab";
      await page.keyboard.press(nextLinkKey);
      await expect(secondLocale).toBeFocused();
      await expect(secondLocale).toHaveAttribute(
        "href",
        localizePath(second, "/contact"),
      );

      const outline = await visibleOutline(secondLocale);
      expect(outline.style).not.toBe("none");
      expect(outline.width).toBeGreaterThanOrEqual(2);
      return;
    }

    const toggle = page.getByTestId("language-toggle-button");
    const menu = page.getByTestId("language-dropdown-content");
    // 等待增强菜单入口后只激活一次，不再重按 Enter 掩盖水合问题。
    await expect(toggle).toHaveAttribute("aria-haspopup", "menu");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await expectDesktopLanguageMenuKeyboardReady(page);
    await page.keyboard.press("ArrowDown");

    const highlighted = page
      .getByTestId("language-dropdown-content")
      .locator("[data-highlighted]");
    await expect(highlighted).toHaveCount(1);

    // 无轮廓时才依赖背景差异，避免透明/白底高亮与菜单底色相同而不可见。
    const outline = await visibleOutline(highlighted);
    const background = await highlighted.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    const menuBackground = await page
      .getByTestId("language-dropdown-content")
      .evaluate((element) => getComputedStyle(element).backgroundColor);

    const hasOutline = outline.style !== "none" && outline.width > 0;
    expect(hasOutline || background !== menuBackground).toBe(true);
  });
});
