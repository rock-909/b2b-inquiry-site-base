import { expect, test } from "@playwright/test";
import { getHeaderMobileMenuButton } from "./helpers/navigation";
import { DEFAULT_LOCALE, getLocaleMessages } from "./site-page-cases";

// 横幅只在构建时配置了 GA 才渲染；E2E 构建用假 ID 打开它（预览环境不会加载 GA）。
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
