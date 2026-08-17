import { expect, test } from "@playwright/test";
import { getHeaderMobileMenuButton } from "./helpers/navigation";

test.describe("Preserved navigation state", () => {
  test.describe("mobile menu", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

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

    test("traps focus and locks page scrolling while open", async ({
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
        expect(
          await dialog.evaluate((element) =>
            element.contains(document.activeElement),
          ),
        ).toBe(true);
      }

      await page.mouse.wheel(0, 1200);
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          ),
      );
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    });

    test("dismisses from the backdrop without moving the page", async ({
      page,
    }) => {
      const trigger = getHeaderMobileMenuButton(page);
      await trigger.click();

      const dialog = page.getByRole("dialog", { name: /mobile navigation/i });
      await expect(dialog).toBeVisible();

      await page.touchscreen.tap(20, 420);
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
