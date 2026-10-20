import { expect, test } from "@playwright/test";
import { getHeaderMobileMenuButton } from "./helpers/navigation";
import { DEFAULT_LOCALE, getLocaleMessages } from "./site-page-cases";

// 横幅只在构建时配置了 GA 才渲染；E2E 构建用假 ID 打开它。
test.use({ viewport: { width: 390, height: 844 } });

test("the open mobile menu covers the cookie banner", async ({ page }) => {
  await page.goto("/");
  const { cookie, accessibility } = getLocaleMessages(DEFAULT_LOCALE);
  // 模态菜单打开后页面其余部分被 aria-hidden，定位横幅需要 includeHidden。
  const banner = page.getByRole("region", {
    name: cookie.title,
    includeHidden: true,
  });
  await expect(banner).toBeVisible();

  await getHeaderMobileMenuButton(page).click();
  await expect(
    page.getByRole("dialog", { name: accessibility.mobileNavigation }),
  ).toBeVisible();

  // 菜单打开时，横幅中心点处最上层的元素必须是菜单或遮罩，而不是横幅本身。
  await expect
    .poll(() =>
      banner.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return hit !== null && element.contains(hit);
      }),
    )
    .toBe(false);
});

test("withdrawing consent in cookie settings removes GA cookies", async ({
  page,
  context,
  baseURL,
}) => {
  // gtag 不得真正联网：所有 Google 请求就地中止，GA cookie 由用例自己种下。
  await page.route(/googletagmanager\.com|google-analytics\.com/u, (route) =>
    route.abort(),
  );
  // 裸 localhost 存不了 Domain cookie；*.localhost 同样解析到回环地址，借子域名覆盖 GA 的两种写法。
  const site = new URL(baseURL!);
  if (site.hostname === "localhost") site.hostname = "www.site.localhost";
  const parentDomain = site.hostname.replace(/^[^.]+\./u, ".");
  await page.goto(site.href);
  const { cookie } = getLocaleMessages(DEFAULT_LOCALE);
  await page.getByRole("button", { name: cookie.acceptAll }).click();

  // GA 默认写在可写的最高一级域名上（Domain=.example.com），也可能是仅主机形式；两种都种。
  await context.addCookies(
    ["_ga", "_ga_E2ETEST000"].flatMap((name) => [
      { name, value: "GA1.1.1.1", url: site.origin },
      { name, value: "GA1.1.1.1", domain: parentDomain, path: "/" },
    ]),
  );
  const gaCookies = async () =>
    (await context.cookies())
      .filter(({ name }) => name === "_ga" || name.startsWith("_ga_"))
      .map(({ name, domain }) => `${name}@${domain}`);
  expect(await gaCookies()).toHaveLength(4);

  await page.getByRole("button", { name: cookie.settings }).click();
  await expect(page.getByRole("region", { name: cookie.title })).toBeVisible();
  await expect.poll(gaCookies).toEqual([]);
});
