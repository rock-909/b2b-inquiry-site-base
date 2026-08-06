import { expect, test, type Page } from "@playwright/test";
import { checkA11y } from "./helpers/axe";
import { waitForLoadWithFallback } from "./test-environment-setup";

// English-only site: `resources` and `blog` are retired routes (they 404), and
// `/zh/*` 404s as well. A 404 page still renders main#main-content + an h1 with
// no overflow, so keeping those entries produced false-green assertions. Scope
// the calibration to the real English core pages instead.
const corePages = ["/about", "/products", "/contact"] as const;

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

          await expect(page.locator("main#main-content")).toBeVisible();
          await expect(
            page.locator("main#main-content h1").first(),
          ).toBeVisible();
          await expectNoHorizontalOverflow(page);
          expect(pageErrors).toStrictEqual([]);

          await testInfo.attach(
            `${viewport.name}-${colorScheme}-${path.replace(/\//gu, "-")}.png`,
            {
              body: await page.screenshot({ fullPage: true }),
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

  test("contact and request-quote full pages have no critical or serious a11y issues", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const pageErrors = collectPageErrors(page);
    const leadSurfaces = ["/contact", "/request-quote"] as const;

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

  test("home FAQ SectionHead uses 24px section heading at 375px viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await preparePage(page, "/");

    const sectionHeading = page.locator(
      '[data-testid="home-faq-section"] h2.text-section',
    );
    await sectionHeading.scrollIntoViewIfNeeded();
    await expect(sectionHeading).toBeVisible();

    const fontSize = await sectionHeading.evaluate(
      (element) => window.getComputedStyle(element).fontSize,
    );
    expect(fontSize).toBe("24px");
  });

  test("home FAQ SectionHead uses 28px section heading at 1280px viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await preparePage(page, "/");

    const sectionHeading = page.locator(
      '[data-testid="home-faq-section"] h2.text-section',
    );
    await sectionHeading.scrollIntoViewIfNeeded();
    await expect(sectionHeading).toBeVisible();

    const fontSize = await sectionHeading.evaluate(
      (element) => window.getComputedStyle(element).fontSize,
    );
    expect(fontSize).toBe("28px");
  });
});
