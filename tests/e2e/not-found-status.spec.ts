import { expect, test } from "@playwright/test";

/**
 * Not-found status contract.
 *
 * Any URL the site does not serve must answer 404. A 5xx tells crawlers the
 * site is broken rather than the page is gone, which is a far more damaging
 * signal, and it shows buyers a server error when they follow a stale link.
 *
 * Paths containing a dot skip the middleware matcher, so they never reach the
 * locale routing that the [locale] segment's not-found page depends on. They
 * are the cases that regress silently.
 */

const MISSING_PATHS = [
  "/nope",
  "/products/not-a-real-product",
  "/random.txt",
  "/does-not-exist.svg",
  "/images/retired-asset.jpg",
  "/next.svg",
] as const;

// 断言的是 HTTP 状态码，不是渲染结果，所以走 request 而不是 page.goto：导航到一张
// PNG 在 firefox 上等不到 domcontentloaded，会顶满 30s 超时——测的东西跟浏览器怎么
// 展示这个响应无关，不该受它影响。
test.describe("Missing URLs answer 404", () => {
  for (const path of MISSING_PATHS) {
    test(`${path} returns 404`, async ({ request }) => {
      const response = await request.get(`http://localhost:3000${path}`);

      expect(response.status(), `${path} should be 404`).toBe(404);
    });
  }

  test("a served asset still returns 200", async ({ request }) => {
    const response = await request.get(
      "http://localhost:3000/images/tucsenberg-og.png",
    );

    expect(response.status()).toBe(200);
  });
});
