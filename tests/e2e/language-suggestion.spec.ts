import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  DEFAULT_LOCALE,
  getLocaleMessages,
  localePrefix,
  SECOND_LOCALE,
} from "./site-page-cases";
import { expectHtmlLang } from "./helpers/navigation";

test.skip(SECOND_LOCALE === undefined, "单语种站点没有可建议的其他语言");

const SECOND = SECOND_LOCALE ?? DEFAULT_LOCALE;
const SECOND_COPY = getLocaleMessages(SECOND).languageSuggestion;
const CONTACT_QUERY = "?source=suggestion-e2e#inquiry";

// 浏览器首选第二语言，打开默认语言页面，应当用第二语言建议切换。
test.use({ locale: SECOND });

function suggestion(page: Page): Locator {
  return page.getByRole("region", { name: SECOND_COPY.label });
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

test("the prompt is not in the server HTML and appears in the suggested language", async ({
  page,
}) => {
  const response = await page.goto(`/contact${CONTACT_QUERY}`);
  // 文案随 RSC 数据预先下发，但服务端 HTML 不渲染提示元素：爬虫和无 JS 页面不变。
  expect(await response?.text()).not.toContain(
    'data-testid="language-suggestion"',
  );

  const region = suggestion(page);
  await expect(region).toBeVisible();
  await expect(region).toHaveAttribute("lang", SECOND);
  await expect(
    region.getByRole("link", { name: SECOND_COPY.switchAction }),
  ).toHaveAttribute("href", `${localePrefix(SECOND)}/contact${CONTACT_QUERY}`);
});

test("switching keeps the unsubmitted inquiry draft and the prompt stays away", async ({
  page,
}) => {
  await page.goto(`/contact${CONTACT_QUERY}`);
  const fullName = page.locator('input[name="fullName"]');
  await expect(fullName).toBeEditable({ timeout: 15_000 });
  await fullName.fill("Suggestion Buyer");

  await suggestion(page)
    .getByRole("link", { name: SECOND_COPY.switchAction })
    .click();

  await expectHtmlLang(page, SECOND);
  expect(new URL(page.url()).pathname).toBe(`${localePrefix(SECOND)}/contact`);
  await expect(page.locator('input[name="fullName"]')).toHaveValue(
    "Suggestion Buyer",
  );
  await expect(page.getByTestId("language-suggestion")).toHaveCount(0);
});

test("closing is remembered across reloads", async ({ page }) => {
  await page.goto("/contact");
  await suggestion(page)
    .getByRole("button", { name: SECOND_COPY.dismiss })
    .click();
  await expect(page.getByTestId("language-suggestion")).toHaveCount(0);

  await page.reload();
  // 等到头部语言菜单水合，客户端已经有机会判断是否显示提示。
  await expect(page.getByTestId("language-toggle-button")).toHaveAttribute(
    "aria-haspopup",
    "menu",
  );
  await expect(page.getByTestId("language-suggestion")).toHaveCount(0);
});

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "laptop", width: 1280, height: 720 },
]) {
  test(`on a ${viewport.name} the prompt sits clear of the cookie card and the submit button`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/contact");
    const { cookie } = getLocaleMessages(DEFAULT_LOCALE);
    const banner = page.getByRole("region", { name: cookie.title });
    await banner.getByRole("button", { name: cookie.customize }).click();
    const region = suggestion(page);
    await expect(region.getByRole("link")).toBeVisible();

    const pill = region.locator("> div");
    await expect
      .poll(async () => {
        const [pillBox, bannerBox] = await Promise.all([
          pill.boundingBox(),
          banner.boundingBox(),
        ]);
        return pillBox !== null && bannerBox !== null
          ? boxesOverlap(pillBox, bannerBox)
          : null;
      })
      .toBe(false);

    // 提交按钮滚到视口中部时，中心点处最上层的元素必须是按钮本身。
    const submit = page.locator("#inquiry button[type=submit]");
    await submit.evaluate((element) =>
      element.scrollIntoView({ block: "center" }),
    );
    await expect
      .poll(() =>
        submit.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );
          return hit !== null && element.contains(hit);
        }),
      )
      .toBe(true);
  });
}
