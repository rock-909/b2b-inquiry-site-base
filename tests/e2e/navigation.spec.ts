import { expect, test } from "@playwright/test";
import { getHeaderMobileMenuButton } from "./helpers/navigation";

test.describe("Preserved navigation state", () => {
  test.describe("mobile menu", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test.beforeEach(async ({ page }) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
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
