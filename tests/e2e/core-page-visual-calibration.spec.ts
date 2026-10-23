import { expect, test, type Page } from "@playwright/test";
import { PUBLIC_STATIC_PAGE_DEFINITIONS } from "@/config/pages.config";
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import { checkA11y } from "./helpers/axe";
import { getLocaleMessages, localizePath } from "./site-page-cases";
import { collectBrowserErrors } from "./test-environment-setup";

// A 404 page still renders main#main-content + an h1 with no overflow, so scope
// the calibration to real public pages instead of missing-route fixtures.
const corePages = LOCALES_CONFIG.locales.flatMap((locale) =>
  PUBLIC_STATIC_PAGE_DEFINITIONS.map(({ pageType, path }) => ({
    pageType,
    path: localizePath(locale, path),
    theme: getLocaleMessages(locale).theme,
  })),
);

async function preparePage(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `${path} should render a real page`).toBe(200);
  await page.waitForLoadState("load");
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );

  expect(hasOverflow).toBe(false);
}

test.describe("Core page visual calibration", () => {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
    { name: "narrow", width: 320, height: 844 },
  ] as const) {
    // 断言与配色无关；暗色只在桌面留一组，证明切到暗色不出错。主题切换归
    // theme-persistence.spec.ts，暗色对比度归 design-token-contract.test.ts。
    for (const colorScheme of viewport.name === "desktop"
      ? (["light", "dark"] as const)
      : (["light"] as const)) {
      for (const { pageType, path, theme } of corePages) {
        test(`${viewport.name} ${colorScheme} ${path} stays readable without overflow`, async ({
          page,
        }) => {
          await page.emulateMedia({ colorScheme });
          await page.setViewportSize({
            width: viewport.width,
            height: viewport.height,
          });
          const pageErrors = collectBrowserErrors(page);
          await preparePage(page, path);

          const themeButton = page
            .getByTestId("footer-theme-toggle")
            .getByRole("button", {
              name:
                colorScheme === "dark"
                  ? theme.switchToDark
                  : theme.switchToLight,
            });
          await themeButton.click();
          await expect(page.locator("html")).toHaveClass(
            colorScheme === "dark" ? /\bdark\b/u : /\blight\b/u,
          );
          await page.evaluate(() => window.scrollTo(0, 0));
          // 只有派生站配置了 ready logo 时页头才有品牌链接。
          const logoLink = page.locator("header .header-nav-left a");
          if (viewport.width < 840 && (await logoLink.count()) > 0) {
            const logo = await logoLink.boundingBox();
            const contact = await page
              .getByTestId("header-mobile-cta")
              .boundingBox();
            expect(logo).not.toBeNull();
            expect(contact).not.toBeNull();
            expect(logo!.x + logo!.width).toBeLessThanOrEqual(contact!.x);
          }
          await expect(page.locator("main#main-content")).toBeVisible();
          await expect(
            page.locator("main#main-content h1").first(),
          ).toBeVisible();
          if (viewport.name === "desktop" && pageType === "contact") {
            // 宽屏联系页：正文在左、表单在右，两列上下有重叠（并排而不是叠放）。
            const text = await page
              .locator("main#main-content h1")
              .first()
              .boundingBox();
            const form = await page
              .locator("main#main-content form")
              .first()
              .boundingBox();
            expect(text).not.toBeNull();
            expect(form).not.toBeNull();
            expect(text!.x + text!.width).toBeLessThanOrEqual(form!.x);
            expect(form!.y).toBeLessThan(text!.y + text!.height);
          }
          await expectNoHorizontalOverflow(page);
          expect(pageErrors).toStrictEqual([]);
        });
      }
    }
  }

  test("core pages have no critical or serious a11y issues", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const pageErrors = collectBrowserErrors(page);

    for (const { path } of corePages) {
      await preparePage(page, path);

      await expect(page.locator("main#main-content")).toBeVisible();
      await checkA11y(page, "main#main-content", {
        includedImpacts: ["critical", "serious"],
      });
    }

    expect(pageErrors).toStrictEqual([]);
  });

  test("contact full page has no critical or serious a11y issues", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const pageErrors = collectBrowserErrors(page);
    const leadSurfaces = ["/contact"] as const;

    for (const path of leadSurfaces) {
      await preparePage(page, path);

      await expect(
        page.getByRole("navigation", { name: "Main navigation" }),
      ).toBeVisible();
      await expect(page.locator("main#main-content")).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Footer navigation" }),
      ).toBeVisible();
      await expect(
        page.getByRole("group", { name: "Theme selector" }),
      ).toBeVisible();
      await checkA11y(page, "body", {
        includedImpacts: ["critical", "serious"],
      });
    }

    expect(pageErrors).toStrictEqual([]);
  });
});
