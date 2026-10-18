import { expect, test, type Page } from "@playwright/test";
import { checkA11y } from "./helpers/axe";
import { waitForLoadWithFallback } from "./test-environment-setup";

// A 404 page still renders main#main-content + an h1 with no overflow, so scope
// the calibration to real public pages instead of missing-route fixtures.
const corePages = [
  "/",
  "/contact",
  "/privacy",
  "/terms",
  "/es",
  "/es/contact",
  "/es/privacy",
  "/es/terms",
] as const;

async function preparePage(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `${path} should render a real page`).toBe(200);
  await waitForLoadWithFallback(page, {
    context: `core visual calibration ${path}`,
    loadTimeout: 10_000,
    fallbackDelay: 500,
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );

  expect(hasOverflow).toBe(false);
}

function collectPageErrors(page: Page) {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  return pageErrors;
}

test.describe("Core page visual calibration", () => {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
    { name: "narrow", width: 320, height: 844 },
  ] as const) {
    for (const colorScheme of ["light", "dark"] as const) {
      for (const path of corePages) {
        test(`${viewport.name} ${colorScheme} ${path} stays readable without overflow`, async ({
          page,
        }, testInfo) => {
          await page.emulateMedia({ colorScheme });
          await page.setViewportSize({
            width: viewport.width,
            height: viewport.height,
          });
          const pageErrors = collectPageErrors(page);
          await preparePage(page, path);

          const themeButton = page
            .getByTestId("footer-theme-toggle")
            .getByRole("button", {
              name:
                colorScheme === "dark"
                  ? /Switch to dark theme|Cambiar al tema oscuro/u
                  : /Switch to light theme|Cambiar al tema claro/u,
            });
          await themeButton.click();
          await expect(page.locator("html")).toHaveClass(
            colorScheme === "dark" ? /\bdark\b/u : /\blight\b/u,
          );
          await page.evaluate(() => window.scrollTo(0, 0));
          if (viewport.width < 840) {
            const logo = await page
              .locator("header .header-nav-left a")
              .boundingBox();
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
          await expectNoHorizontalOverflow(page);
          expect(pageErrors).toStrictEqual([]);

          await testInfo.attach(
            `${viewport.name}-${colorScheme}-${path.replace(/\//gu, "-")}.png`,
            {
              body: await page.screenshot({
                fullPage: true,
                animations: "disabled",
              }),
              contentType: "image/png",
            },
          );
        });
      }
    }
  }

  test("core pages have no critical or serious a11y issues", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const pageErrors = collectPageErrors(page);

    for (const path of corePages) {
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
    const pageErrors = collectPageErrors(page);
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
