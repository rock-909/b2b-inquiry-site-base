import { expect, test, type Locator } from "@playwright/test";
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

  test("highlighted language menu item has a visible indicator", async ({
    page,
  }) => {
    const toggle = page.getByTestId("language-toggle-button");
    const menu = page.getByTestId("language-dropdown-content");
    // 水合前按下的 Enter 会被吞掉，所以只在菜单还没开时重按，避免把已开的菜单关掉。
    await expect(async () => {
      if (!(await menu.isVisible())) {
        await toggle.focus();
        await page.keyboard.press("Enter");
      }
      await expect(menu).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await page.keyboard.press("ArrowDown");

    const highlighted = page
      .getByTestId("language-dropdown-content")
      .locator("[data-highlighted]");
    await expect(highlighted).toHaveCount(1);

    // 高亮项背景必须和菜单底色不同，否则只剩一个字符串不同、肉眼不可见的透明/白底。
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
