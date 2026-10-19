import { expect, test } from "@playwright/test";
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";
import {
  DEFAULT_LOCALE,
  getLocaleMessages,
  localizePath,
  SECOND_LOCALE,
} from "./site-page-cases";

const SINGLE_LOCALE_REASON = "单语种站点不渲染语言切换";
// 跳过时不会执行，回退值只为让类型收窄。
const SECOND = SECOND_LOCALE ?? DEFAULT_LOCALE;

for (const input of ["mouse", "keyboard"] as const) {
  test(`desktop language choice survives ${input} activation before JavaScript`, async ({
    page,
  }) => {
    test.skip(SECOND_LOCALE === undefined, SINGLE_LOCALE_REASON);
    await page.setViewportSize({ width: 1280, height: 800 });
    let releaseScripts!: () => void;
    const scriptsReady = new Promise<void>((resolve) => {
      releaseScripts = resolve;
    });
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() === "script") await scriptsReady;
      await route.continue();
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto("/contact", { waitUntil: "domcontentloaded" });
      const trigger = page.getByTestId("language-toggle-button");
      if (input === "keyboard") {
        await trigger.focus();
        await page.keyboard.press("Enter");
      } else {
        await trigger.click();
      }
      const choice = page.locator("header").getByRole("link", {
        name: LOCALES_CONFIG.displayNames[SECOND],
        exact: true,
      });
      await expect(choice).toBeVisible();
      const hadFocus = await trigger.evaluate(
        (element) => element === document.activeElement,
      );
      releaseScripts();
      await expect(page.locator('input[name="fullName"]')).toBeEditable();
      await page.waitForLoadState("networkidle");
      await expect(choice).toBeVisible();
      if (hadFocus) await expect(trigger).toBeFocused();
      await choice.click();
      await expect
        .poll(() => new URL(page.url()).pathname)
        .toBe(localizePath(SECOND, "/contact"));
      await expect(page.locator("html")).toHaveAttribute("lang", SECOND);
      expect(errors).toEqual([]);
    } finally {
      releaseScripts();
    }
  });
}

for (const initiallyOpen of [false, true]) {
  test(`native language menu preserves ${initiallyOpen ? "open" : "closed"} focused state until idle`, async ({
    page,
  }) => {
    test.skip(SECOND_LOCALE === undefined, SINGLE_LOCALE_REASON);
    await page.setViewportSize({ width: 1280, height: 800 });
    let releaseScripts!: () => void;
    const scriptsReady = new Promise<void>((resolve) => {
      releaseScripts = resolve;
    });
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() === "script") await scriptsReady;
      await route.continue();
    });
    try {
      await page.goto("/contact", { waitUntil: "domcontentloaded" });
      const summary = page.locator(
        "header summary[data-testid='language-toggle-button']",
      );
      const details = summary.locator("..");
      await summary.focus();
      if (initiallyOpen) await page.keyboard.press("Enter");
      releaseScripts();
      await expect(page.locator('input[name="fullName"]')).toBeEditable();
      await page.waitForLoadState("networkidle");
      await expect(summary).toBeFocused();
      await expect(details).toHaveJSProperty("open", initiallyOpen);
      if (initiallyOpen) await page.keyboard.press("Enter");
      await expect(details).toHaveJSProperty("open", false);
      await expect(summary).toBeFocused();
      await page.keyboard.press("Tab");
      const enhanced = page.locator(
        "header button[data-testid='language-toggle-button']",
      );
      await expect(enhanced).toBeVisible();
      await expect(summary).toHaveCount(0);
      await page.keyboard.press("Shift+Tab");
      await expect(enhanced).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("language-dropdown-content")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(enhanced).toBeFocused();
    } finally {
      releaseScripts();
    }
  });
}

for (const locale of LOCALES_CONFIG.locales) {
  const path = localizePath(locale, "/contact");
  const target = locale === DEFAULT_LOCALE ? SECOND : DEFAULT_LOCALE;
  test(`desktop ${locale} language choice works without JavaScript`, async ({
    browser,
  }) => {
    test.skip(SECOND_LOCALE === undefined, SINGLE_LOCALE_REASON);
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    try {
      await page.goto(new URL(path, test.info().project.use.baseURL).href);
      await page.getByTestId("language-toggle-button").focus();
      await page.keyboard.press("Enter");
      await page
        .locator("header")
        .getByRole("link", {
          name: LOCALES_CONFIG.displayNames[target],
          exact: true,
        })
        .click();
      await expect(page.locator("html")).toHaveAttribute("lang", target);
      expect(new URL(page.url()).pathname).toBe(
        localizePath(target, "/contact"),
      );
    } finally {
      await context.close();
    }
  });
  for (const javaScriptEnabled of [true, false]) {
    test(`${locale} contact inquiry link reaches its ${javaScriptEnabled ? "form" : "static fallback"}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        javaScriptEnabled,
        viewport: { width: 1280, height: 800 },
      });
      const page = await context.newPage();
      try {
        await page.goto(new URL(path, test.info().project.use.baseURL).href);
        // 按目标锚点定位正文里的询盘链接，不钉联系页文案。
        await page
          .getByRole("main")
          .locator('a[href$="#inquiry"]')
          .first()
          .click();
        await expect(page).toHaveURL(/#inquiry$/u);
        const target = page.locator("#inquiry");
        await expect(target).toHaveCount(1);
        await expect(target).toBeInViewport();
        if (javaScriptEnabled)
          await expect(target.locator('input[name="fullName"]')).toBeEditable();
        else
          await expect(
            target.getByTestId("inquiry-form-static-fallback"),
          ).toBeVisible();
        const headerBottom = await page
          .locator("header")
          .first()
          .evaluate((element) => element.getBoundingClientRect().bottom);
        const targetTop = await target.evaluate(
          (element) => element.getBoundingClientRect().top,
        );
        expect(targetTop).toBeGreaterThanOrEqual(headerBottom);
      } finally {
        await context.close();
      }
    });
  }
}

for (const missing of ["/audit-missing-section/offering", "/random.txt"]) {
  const path = localizePath(SECOND, missing);
  test(`${path} keeps localized noindex 404 metadata`, async ({ page }) => {
    test.skip(SECOND_LOCALE === undefined, "单语种站点没有带前缀的语种 404");
    const messages = getLocaleMessages(SECOND);
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", SECOND);
    await expect(page).toHaveTitle(
      `${messages.errors.notFound.title} | ${SINGLE_SITE_CONFIG.name}`,
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      messages.home.metadata.description,
    );
    const robots = await page
      .locator('meta[name="robots"]')
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("content")).join(","),
      );
    expect(robots).toContain("noindex");
    await expect(
      page.locator(
        'link[rel="canonical"], link[hreflang], meta[property="og:url"], meta[property="og:image"]',
      ),
    ).toHaveCount(0);
  });
}
