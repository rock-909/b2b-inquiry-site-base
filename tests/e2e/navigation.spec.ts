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
  await page.route("**/contact?**", async (route) => {
    await responseGate;
    await route.continue();
  });
  // 联系页只由头部 CTA 承担；CTA 与导航项共用同一个 pending 反馈。
  const contact = page
    .getByRole("banner")
    .getByRole("link", { name: "Start an inquiry", exact: true });
  try {
    await contact.click();
    await expect(contact.getByTestId("navigation-pending")).toBeVisible();
  } finally {
    release();
  }
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByTestId("navigation-pending")).toHaveCount(0);
});

test("marks the current page in the desktop nav with the brand text colour", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const current = page
    .getByTestId("header-desktop-nav")
    .locator('[aria-current="page"]');
  await expect(current).toHaveText("Home");

  // 读屏靠 aria-current；视觉上当前页必须是品牌字色，而不是普通导航项的弱文字色。
  await expect
    .poll(() =>
      current.evaluate((element) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--primary-text)";
        document.body.append(probe);
        const brand = getComputedStyle(probe).color;
        probe.remove();
        return getComputedStyle(element).color === brand;
      }),
    )
    .toBe(true);
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
      await page.goto("/contact", { waitUntil: "networkidle" });
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
      await dialog
        .getByRole("link", { exact: true, name: "Start an inquiry" })
        .first()
        .click();
      await page.waitForURL(/\/contact$/, { waitUntil: "domcontentloaded" });
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
      await expect(page).toHaveURL(/\/contact$/);
      await expect(getHeaderMobileMenuButton(page)).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });
  });
});
