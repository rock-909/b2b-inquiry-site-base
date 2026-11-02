import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  DEFAULT_LOCALE,
  getLocaleMessages,
  localePrefix,
  SECOND_LOCALE,
} from "./site-page-cases";
import { expectHtmlLang } from "./helpers/navigation";

declare global {
  interface Window {
    __languageBarShift?: number;
  }
}

test.skip(SECOND_LOCALE === undefined, "单语种站点没有可建议的其他语言");

const SECOND = SECOND_LOCALE ?? DEFAULT_LOCALE;
const SECOND_COPY = getLocaleMessages(SECOND).languageSuggestion;
const DEFAULT_COPY = getLocaleMessages(DEFAULT_LOCALE).languageSuggestion;
const CONTACT_QUERY = "?source=suggestion-e2e#inquiry";
const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 720 },
];

// 浏览器首选第二语言，打开默认语言页面，应当用第二语言建议切换。
test.use({ locale: SECOND });

function suggestion(page: Page, copy = SECOND_COPY): Locator {
  return page.getByRole("region", { name: copy.label });
}

// 记录整个加载过程中的布局偏移，要在页面脚本之前装上。
async function trackLayoutShift(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__languageBarShift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        };
        if (!shift.hadRecentInput) {
          window.__languageBarShift =
            (window.__languageBarShift ?? 0) + shift.value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

async function layoutShift(page: Page): Promise<number> {
  // 等两帧，让观察者收到最后一次渲染的记录。
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  return page.evaluate(() => window.__languageBarShift ?? 0);
}

// 扣住页面的外部脚本，用来观察 React 加载之前（只有服务端 HTML 和内联脚本）的页面。
async function holdScripts(page: Page): Promise<() => void> {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() === "script") await released;
    await route.continue();
  });
  return release;
}

// 等到头部语言菜单水合，客户端已经有机会确认或隐藏横条。
async function waitForHydration(page: Page): Promise<void> {
  await expect(page.getByTestId("language-toggle-button")).toHaveAttribute(
    "aria-haspopup",
    "menu",
  );
}

async function makeCookieChoice(page: Page): Promise<void> {
  const { cookie } = getLocaleMessages(DEFAULT_LOCALE);
  await page
    .getByRole("region", { name: cookie.title })
    .getByRole("button", { name: cookie.rejectAll })
    .click();
}

for (const viewport of VIEWPORTS) {
  test(`on a ${viewport.name}, a first visit shows the bar above the header before scripts load, with no layout shift`, async ({
    page,
    browserName,
  }) => {
    await page.setViewportSize(viewport);
    if (browserName === "chromium") {
      // 放慢 CPU（CDP，仅 Chromium），模拟冷启动或低端机：解析中途让出时，浏览器若先绘制半截页头，
      // 右侧控件随后长高、左移就会计入偏移。首屏须等页头解析完才绘制。
      const session = await page.context().newCDPSession(page);
      await session.send("Emulation.setCPUThrottlingRate", { rate: 30 });
    }
    await trackLayoutShift(page);
    const releaseScripts = await holdScripts(page);
    // 用完整长度的页面：模板首页很短，页脚落在首屏内，首次访问时同意卡片给页脚加底部留白
    // 会让页脚上移；这与语言横条无关，默认语言访客同样存在。
    await page.goto("/contact", { waitUntil: "domcontentloaded" });

    // 还没有任何外部脚本运行，横条已经由内联脚本显示在页面最顶部、页头之上。
    const bar = suggestion(page);
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute("lang", SECOND);
    await expect(bar).toContainText(SECOND_COPY.message);
    const barBox = await bar.boundingBox();
    const headerBox = await page.locator("header").first().boundingBox();
    expect(barBox?.y).toBe(0);
    expect(headerBox?.y).toBeGreaterThanOrEqual(
      (barBox?.y ?? 0) + (barBox?.height ?? 0),
    );

    releaseScripts();
    await page.waitForLoadState("load");
    await waitForHydration(page);
    await expect(bar).toBeVisible();
    // 横条在顶部，不和底部的同意卡片抢位置：首次访问两者同时出现。
    const { cookie } = getLocaleMessages(DEFAULT_LOCALE);
    await expect(
      page.getByRole("region", { name: cookie.title }),
    ).toBeVisible();

    // 手机上换行但不撑出横向滚动，关闭按钮仍在视口内；桌面上文字和链接在一行。
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const closeBox = await bar
      .getByRole("button", { name: SECOND_COPY.dismiss })
      .boundingBox();
    expect((closeBox?.x ?? 0) + (closeBox?.width ?? 0)).toBeLessThanOrEqual(
      viewport.width,
    );
    if (viewport.name === "desktop") {
      const lines = await bar
        .locator("p")
        .evaluate(
          (element) =>
            element.getBoundingClientRect().height /
            parseFloat(getComputedStyle(element).lineHeight),
        );
      expect(Math.round(lines)).toBe(1);
    }

    expect(await layoutShift(page)).toBe(0);
  });

  test(`on a ${viewport.name}, a returning visit keeps the bar and the footer still`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await makeCookieChoice(page);
    await waitForHydration(page);

    await trackLayoutShift(page);
    const releaseScripts = await holdScripts(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    const footer = page.locator("footer").first();
    const footerBefore = await footer.evaluate(
      (element) => element.getBoundingClientRect().top + window.scrollY,
    );
    await expect(suggestion(page)).toBeVisible();

    releaseScripts();
    await page.waitForLoadState("load");
    await waitForHydration(page);
    await expect(suggestion(page)).toBeVisible();
    const footerAfter = await footer.evaluate(
      (element) => element.getBoundingClientRect().top + window.scrollY,
    );
    expect(footerAfter).toBe(footerBefore);
    expect(await layoutShift(page)).toBe(0);
  });
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  // 服务端 HTML 带着建议语言的横条，但默认 hidden：无 JS 页面和爬虫看到的页面不变。
  test("the bar is in the page, in the suggested language, and stays hidden", async ({
    page,
  }) => {
    await page.goto("/contact");
    const bar = page.locator(`#language-suggestion-${SECOND}`);
    await expect(bar).toHaveCount(1);
    await expect(bar).toHaveAttribute("lang", SECOND);
    await expect(bar).toContainText(SECOND_COPY.message);
    await expect(bar).toBeHidden();
  });
});

test("the bar comes before the header in tab order", async ({ page }) => {
  await page.goto("/contact");
  await waitForHydration(page);
  const link = suggestion(page).getByRole("link", {
    name: SECOND_COPY.switchAction,
  });

  // 第一个 Tab 落在跳转到正文的链接上，下一个就是横条的切换链接，然后是关闭按钮。
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    suggestion(page).getByRole("button", { name: SECOND_COPY.dismiss }),
  ).toBeFocused();
});

test("before scripts load, the switch link already keeps the query and hash", async ({
  page,
}) => {
  const releaseScripts = await holdScripts(page);
  await page.goto(`/contact${CONTACT_QUERY}`, {
    waitUntil: "domcontentloaded",
  });
  const link = suggestion(page).getByRole("link", {
    name: SECOND_COPY.switchAction,
  });
  await expect(link).toHaveAttribute(
    "href",
    `${localePrefix(SECOND)}/contact${CONTACT_QUERY}`,
  );

  releaseScripts();
  await page.waitForLoadState("load");
  await waitForHydration(page);
  await expect(link).toHaveAttribute(
    "href",
    `${localePrefix(SECOND)}/contact${CONTACT_QUERY}`,
  );
});

test("switching reaches the equivalent page, keeps the inquiry draft and the bar stays away", async ({
  page,
}) => {
  await page.goto(`/contact${CONTACT_QUERY}`);
  const fullName = page.locator('input[name="fullName"]');
  await expect(fullName).toBeEditable({ timeout: 15_000 });
  await fullName.fill("Suggestion Buyer");

  const link = suggestion(page).getByRole("link", {
    name: SECOND_COPY.switchAction,
  });
  await expect(link).toHaveAttribute(
    "href",
    `${localePrefix(SECOND)}/contact${CONTACT_QUERY}`,
  );
  await link.click();

  await expectHtmlLang(page, SECOND);
  expect(new URL(page.url()).pathname).toBe(`${localePrefix(SECOND)}/contact`);
  await expect(page.locator('input[name="fullName"]')).toHaveValue(
    "Suggestion Buyer",
  );
  await waitForHydration(page);
  await expect(suggestion(page, DEFAULT_COPY)).toHaveCount(0);
});

test("closing hides the bar and it stays hidden on reload, even before scripts load", async ({
  page,
}) => {
  await page.goto("/contact");
  await waitForHydration(page);
  await suggestion(page)
    .getByRole("button", { name: SECOND_COPY.dismiss })
    .click();
  await expect(suggestion(page)).toHaveCount(0);

  const releaseScripts = await holdScripts(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(`#language-suggestion-${SECOND}`)).toBeHidden();
  releaseScripts();
  await page.waitForLoadState("load");
  await waitForHydration(page);
  await expect(suggestion(page)).toHaveCount(0);
});

test.describe("a default-language visitor", () => {
  test.use({ locale: DEFAULT_LOCALE });

  test("never sees the bar on default-language pages", async ({ page }) => {
    for (const path of ["/", "/contact"]) {
      await page.goto(path);
      await waitForHydration(page);
      await expect(page.locator(`#language-suggestion-${SECOND}`)).toBeHidden();
      await expect(suggestion(page)).toHaveCount(0);
    }
  });

  // 反向：默认语言的访客打开第二语言页面，横条用默认语言建议回到默认语言页面。
  test("on a second-language page sees the bar in the default language, with no layout shift", async ({
    page,
  }) => {
    await trackLayoutShift(page);
    await page.goto(`${localePrefix(SECOND)}/contact`);
    await waitForHydration(page);
    const bar = suggestion(page, DEFAULT_COPY);
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute("lang", DEFAULT_LOCALE);
    await expect(
      bar.getByRole("link", { name: DEFAULT_COPY.switchAction }),
    ).toHaveAttribute("href", "/contact");
    expect(await layoutShift(page)).toBe(0);
  });
});
