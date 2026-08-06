import { expect, test } from "@playwright/test";
import { SITE_PAGE_CASES } from "./site-page-cases";

test.describe("Tucsenberg site smoke", () => {
  for (const [path, heading] of SITE_PAGE_CASES) {
    test(`${path} renders current site content`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });

      expect(response?.status(), `${path} should return HTTP 200`).toBe(200);
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
    });
  }

  test("current site exposes no Chinese language entry", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });

    expect(response?.status(), "/ should return HTTP 200").toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByText("简体中文")).toHaveCount(0);
    await expect(page.getByText("中文")).toHaveCount(0);
    await expect(page.locator('a[hreflang="zh"]')).toHaveCount(0);
    await expect(page.locator('a[href="/zh"]')).toHaveCount(0);
  });

  for (const removedRoute of ["/zh", "/zh/contact"] as const) {
    test(`${removedRoute} is not a live language route`, async ({ page }) => {
      const response = await page.goto(removedRoute, {
        waitUntil: "domcontentloaded",
      });

      expect(response?.status(), `${removedRoute} should return HTTP 404`).toBe(
        404,
      );
      await expect(page.locator("html")).not.toHaveAttribute("lang", "zh");
      await expect(page.getByText("简体中文")).toHaveCount(0);
      await expect(page.getByText("中文")).toHaveCount(0);
      await expect(page.locator('a[hreflang="zh"]')).toHaveCount(0);
      await expect(page.locator('a[href="/zh"]')).toHaveCount(0);
    });
  }

  test("public PDF downloads stay noindex", async ({ request }) => {
    const response = await request.head("/downloads/spec-sheet-tb-ag.pdf");

    expect(response.status()).toBe(200);
    expect(response.headers()["x-robots-tag"]).toBe("noindex");
  });
});
