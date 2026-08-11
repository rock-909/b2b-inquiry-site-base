import { expect, test } from "@playwright/test";

test("unknown routes render the site 404 with a homepage recovery link", async ({
  page,
}) => {
  const response = await page.goto("/this-page-does-not-exist", {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(404);

  const main = page.getByRole("main");
  await expect(main.getByText("404", { exact: true })).toBeVisible();
  await expect(
    main.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await expect(
    main.getByRole("link", { name: "Back to homepage" }),
  ).toBeVisible();
});

// 带点的地址走不到品牌 404 页，这是结构限制，不是漏测：proxy matcher 把它们
// 排除，`random.txt` 会被当作 locale 值落到 `[locale]` 段上，而品牌 404 页本身就
// 住在这个段里、需要一个合法 locale 才能渲染。它们拿到的是 Next 自带的那张
// "This page could not be found."，状态码仍然是 404（由 not-found-status.spec.ts
// 守住）。这类地址基本只有爬虫和旧资源链接会访问，真人打错的路径不带点。
// 要让它们也进品牌页，得加一层根级 layout + not-found，代价远大于收益。
test("dotted unknown URLs still answer 404, on the framework fallback page", async ({
  page,
}) => {
  const response = await page.goto("/random.txt", {
    waitUntil: "domcontentloaded",
  });

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
});
