import { expect, test } from "@playwright/test";
import { SITE_PAGE_CASES } from "./site-page-cases";

test.describe("site smoke", () => {
  for (const [path, heading] of SITE_PAGE_CASES) {
    test(`${path} renders current site content`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });

      expect(response?.status(), `${path} should return HTTP 200`).toBe(200);
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
    });
  }
});
