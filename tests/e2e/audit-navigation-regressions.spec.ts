import { expect, test } from "@playwright/test";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";
import spanish from "../../messages/base/es/messages.json";

for (const input of ["mouse", "keyboard"] as const) {
  test(`desktop language choice survives ${input} activation before JavaScript`, async ({
    page,
  }) => {
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
      const choice = page
        .locator("header")
        .getByRole("link", { name: "Español", exact: true });
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
      await expect(page).toHaveURL(/\/es\/contact$/u);
      await expect(page.locator("html")).toHaveAttribute("lang", "es");
      expect(errors).toEqual([]);
    } finally {
      releaseScripts();
    }
  });
}

for (const locale of ["en", "es"] as const) {
  const path = locale === "en" ? "/contact" : "/es/contact";
  test(`desktop ${locale} language choice works without JavaScript`, async ({
    browser,
  }) => {
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
          name: locale === "en" ? "Español" : "English",
          exact: true,
        })
        .click();
      await expect(page.locator("html")).toHaveAttribute(
        "lang",
        locale === "en" ? "es" : "en",
      );
      expect(new URL(page.url()).pathname).toBe(
        locale === "en" ? "/es/contact" : "/contact",
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
        await page
          .getByRole("link", {
            name: locale === "en" ? "inquiry form" : "formulario de consulta",
            exact: true,
          })
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

for (const path of ["/es/products/audit-missing-offering", "/es/random.txt"]) {
  test(`${path} keeps localized noindex 404 metadata`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page).toHaveTitle(
      spanish.home.metadata.title.replace(
        "{siteName}",
        SINGLE_SITE_CONFIG.name,
      ),
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      spanish.home.metadata.description,
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
