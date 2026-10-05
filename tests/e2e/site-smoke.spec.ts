import { expect, test } from "@playwright/test";
import en from "../../messages/base/en/messages.json";
import { SITE_PAGE_CASES } from "./site-page-cases";

test.describe("site smoke", () => {
  for (const [path, heading] of SITE_PAGE_CASES) {
    test(`${path} renders current site content`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      const response = await page.goto(path, { waitUntil: "domcontentloaded" });

      expect(response?.status(), `${path} should return HTTP 200`).toBe(200);
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
      // domcontentloaded 和 load 都不能保证 hydration 已完成；等待页脚主题按钮
      // 在自身 hydration 后启用，再检查截至此时收集到的客户端错误。
      await expect(
        page.getByRole("button", { name: en.theme.switchToSystem }),
      ).toBeEnabled();
      expect(
        pageErrors,
        `${path} should not throw in the browser`,
      ).toStrictEqual([]);
    });
  }
});
