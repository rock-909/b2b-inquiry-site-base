import { expect, test } from "@playwright/test";
import { localizePath, SECOND_LOCALE } from "./site-page-cases";

/**
 * Not-found status contract.
 *
 * Any URL the site does not serve must answer 404. A 5xx tells crawlers the
 * site is broken rather than the page is gone, which is a far more damaging
 * signal, and it shows buyers a server error when they follow a stale link.
 *
 */

// 探针用明显不会被派生站占用的路径，避免加新页面后这里反向失败。
const MISSING_PATHS = [
  "/nope",
  "/__e2e-missing-page",
  ...(SECOND_LOCALE
    ? [localizePath(SECOND_LOCALE, "/__e2e-missing-page")]
    : []),
  "/__e2e-missing-section/offering",
  "/random.txt",
  "/does-not-exist.svg",
  "/images/retired-asset.jpg",
  "/next.svg",
] as const;

// 断言的是 HTTP 状态码，不是渲染结果，所以走 request 而不是 page.goto：导航到一张
// PNG 在 firefox 上等不到 domcontentloaded，会顶满 30s 超时——测的东西跟浏览器怎么
// 展示这个响应无关，不该受它影响。
test.describe("Missing URLs answer 404", () => {
  test("root 404 does not publish inherited OG image metadata", async ({
    page,
  }) => {
    // 缺失带点路径的 404 不应继承页面图片元数据。
    const response = await page.goto("/random.txt");
    expect(response?.status()).toBe(404);
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
    await expect(page.locator('meta[name="twitter:image"]')).toHaveCount(0);
  });
  for (const path of MISSING_PATHS) {
    test(`${path} returns 404`, async ({ request }) => {
      const response = await request.get(path);

      expect(response.status(), `${path} should be 404`).toBe(404);
    });
  }

  test("a served asset still returns 200", async ({ request }) => {
    const response = await request.get("/.well-known/security.txt");

    expect(response.status()).toBe(200);
  });
});
