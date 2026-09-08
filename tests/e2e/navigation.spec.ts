import { expect, test } from "@playwright/test";
import { getHeaderMobileMenuButton } from "./helpers/navigation";

test("shows real pending feedback while a navigation response is delayed", async ({
  page,
}) => {
  let release: () => void = () => undefined;
  const responseGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.route("**/products?**", async (route) => {
    await responseGate;
    await route.continue();
  });
  const products = page
    .getByTestId("header-desktop-nav")
    .getByRole("link", { name: "Products", exact: true });
  try {
    await products.click();
    await expect(products.getByTestId("navigation-pending")).toBeVisible();
  } finally {
    release();
  }
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByTestId("navigation-pending")).toHaveCount(0);
});

test.describe("Preserved navigation state", () => {
  test.describe("mobile menu", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test.beforeEach(async ({ page }) => {
      await page.goto("/", { waitUntil: "networkidle" });
    });

    test("returns focus to the trigger after Escape", async ({ page }) => {
      const trigger = getHeaderMobileMenuButton(page);
      await trigger.click();

      const dialog = page.getByRole("dialog", { name: /mobile navigation/i });
      await expect(dialog).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    });

    test("traps focus and locks keyboard page scrolling while open", async ({
      page,
    }) => {
      const trigger = getHeaderMobileMenuButton(page);
      await trigger.click();

      const dialog = page.getByRole("dialog", { name: /mobile navigation/i });
      await expect(dialog).toBeVisible();
      await expect
        .poll(() =>
          dialog.evaluate((element) =>
            element.contains(document.activeElement),
          ),
        )
        .toBe(true);

      for (let index = 0; index < 8; index += 1) {
        await page.keyboard.press("Tab");
        await expect
          .poll(() =>
            dialog.evaluate((element) =>
              element.contains(document.activeElement),
            ),
          )
          .toBe(true);
      }

      await page.keyboard.press("PageDown");
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          ),
      );
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await page.keyboard.press("PageDown");
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(0);
    });

    test("dismisses from the backdrop without moving the page", async ({
      page,
      hasTouch,
    }) => {
      const trigger = getHeaderMobileMenuButton(page);
      await trigger.click();

      const dialog = page.getByRole("dialog", { name: /mobile navigation/i });
      await expect(dialog).toBeVisible();

      // 使用项目的真实输入能力，不给桌面 Firefox 强行开启触屏。
      if (hasTouch) await page.touchscreen.tap(20, 420);
      else await page.mouse.click(20, 420);
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    });

    test("stays closed across route back and forward", async ({ page }) => {
      const trigger = getHeaderMobileMenuButton(page);
      await trigger.click();

      const dialog = page.getByRole("dialog", { name: /mobile navigation/i });
      await dialog.getByRole("link", { exact: true, name: "About" }).click();
      await page.waitForURL(/\/about$/, { waitUntil: "domcontentloaded" });
      await expect(getHeaderMobileMenuButton(page)).toHaveAttribute(
        "aria-expanded",
        "false",
      );

      await page.goBack({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/$/);
      await expect(getHeaderMobileMenuButton(page)).toHaveAttribute(
        "aria-expanded",
        "false",
      );

      await page.goForward({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/about$/);
      await expect(getHeaderMobileMenuButton(page)).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });
  });
});
