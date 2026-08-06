import { expect, test } from "@playwright/test";
import { acceptCookieBannerIfVisible } from "./test-environment-setup";

test("dark theme preference survives a page reload", async ({ page }) => {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);

  const cookieDialog = page.getByRole("dialog", {
    name: /cookie preferences/i,
  });
  await expect(cookieDialog).toBeVisible();
  await cookieDialog.getByRole("button", { name: /accept all/i }).click();
  await expect(cookieDialog).not.toBeVisible();

  const darkThemeButton = page
    .getByTestId("footer-theme-toggle")
    .getByRole("button", { name: "Switch to dark theme" });
  await expect(darkThemeButton).toBeEnabled();
  await darkThemeButton.click();
  await expect(page.locator("html")).toHaveClass(/dark/u);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveClass(/dark/u);
});

test("theme switcher changes the page theme via keyboard without losing focus", async ({
  page,
}) => {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await acceptCookieBannerIfVisible(page);

  const themeGroup = page.getByRole("group", { name: /theme selector/i });
  const lightButton = themeGroup.getByRole("button", {
    name: "Switch to light theme",
  });
  const darkButton = themeGroup.getByRole("button", {
    name: "Switch to dark theme",
  });

  await expect(darkButton).toBeEnabled();
  await expect(lightButton).toBeEnabled();
  await darkButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveClass(/dark/u);
  await expect(darkButton).toBeFocused();
  await expect(darkButton).toHaveAttribute("aria-pressed", "true");
  await expect(lightButton).toHaveAttribute("aria-pressed", "false");

  await lightButton.focus();
  await page.keyboard.press("Space");
  await expect(page.locator("html")).not.toHaveClass(/dark/u);
  await expect(lightButton).toBeFocused();
  await expect(lightButton).toHaveAttribute("aria-pressed", "true");
  await expect(darkButton).toHaveAttribute("aria-pressed", "false");
});
