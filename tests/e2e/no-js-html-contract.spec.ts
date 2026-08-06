import { expect, test } from "@playwright/test";
import { getSingleSitePublicStaticPages } from "@/config/single-site-seo";
import { TUCSENBERG_PRODUCT_PAGES } from "@/constants/tucsenberg-product-pages";
import { getHeaderMobileMenuButton } from "./helpers/navigation";

const site = {
  skipLabel: "Skip to main content",
  homeHeading: /Factory-Direct Flood Barriers from China/i,
  contactHeading: /Contact/i,
  fullNameLabel: "Full name",
  optionalLabel: "optional",
} as const;

// BC-025 承诺的是"任何公开页面"，之前这里是一份四条的手抄清单（/about /contact
// /privacy /terms）。产品列表页、OEM、两篇 guide、warranty、五个产品详情页都没走
// 这条断言——某个没覆盖的页面单独加一个错的 Suspense 边界，门禁照样绿。清单改成
// 从页面注册表和产品目录推导，跟 lighthouserc.js 那 16 条路由同源，新增路由自动
// 进入覆盖面。
const canonicalPublicPaths = [
  ...getSingleSitePublicStaticPages().map((path) => path || "/"),
  ...Object.keys(TUCSENBERG_PRODUCT_PAGES).map((slug) => `/products/${slug}`),
];

function expectExactlyOneMain(html: string) {
  expect((html.match(/<main\b/g) ?? []).length).toBe(1);
}

/**
 * A Suspense boundary whose fallback re-renders the same subtree makes React
 * emit the page body twice: once in <main> and once in a trailing hidden
 * container it relocates with inline JS. No-JS visitors never get that
 * relocation, and every visitor pays for the duplicate bytes. Counting the H1
 * catches the whole class, on any route, without naming the boundary.
 */
async function expectBodyRenderedOnce(page: import("@playwright/test").Page) {
  // allTextContents() counts hidden elements too, which is the point: the
  // duplicate lives in a hidden trailing container.
  const headings = await page.locator("h1").allTextContents();
  // Floor first, or the rest passes vacuously on a page that lost its H1:
  // zero headings are trivially unique and trivially all inside main. A floor
  // rather than an exact count, so a route that legitimately ships more than
  // one H1 does not have to fight this helper.
  expect(
    headings.length,
    "page must expose an H1 without JavaScript",
  ).toBeGreaterThan(0);
  expect(new Set(headings).size, "page body must not be rendered twice").toBe(
    headings.length,
  );
  await expect(page.locator("#main-content h1")).toHaveCount(headings.length);
}

/**
 * The inquiry form reserves the live form's height so hydration does not shift
 * the page. Without JavaScript that swap never happens, so a <noscript> rule
 * zeroes the reservation. If that rule stops applying, no-JS visitors get
 * hundreds of pixels of dead space under the email card and nothing else in
 * this suite would notice.
 */
async function expectNoReservedGap(page: import("@playwright/test").Page) {
  // Scoped to #main-content: every inquiry form must render inside the main
  // landmark on the server. A page that defers the form past a streaming
  // boundary leaves its only reservation in the trailing hidden container,
  // which no-JS visitors never see relocated — this locator fails there.
  const reserve = page
    .locator("#main-content [data-inquiry-form-reserve]:visible")
    .first();
  await expect(reserve).toBeVisible();

  const minHeight = await reserve.evaluate(
    (element) => getComputedStyle(element).minHeight,
  );
  expect(minHeight, "noscript must zero the reserved height").toBe("0px");
}

test.describe("No-JS HTML contract (English-only)", () => {
  test.use({ javaScriptEnabled: false });

  test("homepage keeps meaningful structure without client boot", async ({
    page,
  }) => {
    // 桌面视口显式钉住：断言的是桌面导航（header-desktop-nav），移动视口下它
    // 本来就该隐藏。不钉的话这条用例在 Mobile 项目里必然红。移动端的等价
    // 契约由下面那条 mobile 用例覆盖。
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("http://localhost:3000/", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("link", { name: site.skipLabel }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: /main navigation/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: site.homeHeading }),
    ).toBeVisible();

    const html = await page.content();
    expectExactlyOneMain(html);
    // The static shell must be server-rendered (prerendered), proven by the
    // hero H1 living in the raw HTML string — not injected by client boot.
    // NavigationProgressBar reads useSearchParams under an explicit
    // <Suspense fallback={null}> in [locale]/layout.tsx, so Next.js emits a
    // BAILOUT_TO_CLIENT_SIDE_RENDERING marker for that bounded subtree only.
    // That marker is the officially-sanctioned prerender pattern (installed
    // next docs: use-search-params.md, "Prerendering") — a contained subtree
    // bailout, NOT a whole-page bailout — so we do not assert its absence.
    expect(html).toMatch(site.homeHeading);
    expect(html).toContain('id="main-content"');
    await expectBodyRenderedOnce(page);
  });

  test("mobile homepage exposes English-only navigation fallback without JavaScript", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://localhost:3000/", {
      waitUntil: "domcontentloaded",
    });

    const trigger = getHeaderMobileMenuButton(page);
    await expect(trigger).toBeVisible();
    await expect(trigger).not.toHaveAttribute("aria-label");
    await expect(trigger).not.toHaveAttribute("aria-haspopup");
    await expect(trigger).toHaveAccessibleName(/open navigation menu/i);

    await trigger.click();

    const fallbackPanel = page.getByTestId(
      "header-mobile-navigation-fallback-panel",
    );
    await expect(fallbackPanel).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: /mobile navigation menu/i }),
    ).toBeVisible();
    await expect(
      fallbackPanel.getByTestId("mobile-language-fallback"),
    ).toHaveCount(0);
    await expect(fallbackPanel.locator('a[hreflang="zh"]')).toHaveCount(0);
    await expect(fallbackPanel.locator('a[href="/zh"]')).toHaveCount(0);
    await expect(fallbackPanel.getByText("简体中文")).toHaveCount(0);
    await expect(fallbackPanel.getByText("中文")).toHaveCount(0);
  });

  test("retired /zh route stays unavailable without JavaScript", async ({
    page,
  }) => {
    const response = await page.goto("http://localhost:3000/zh", {
      waitUntil: "domcontentloaded",
    });

    expect(response?.status(), "/zh should return HTTP 404").toBe(404);
    await expect(page.locator("html")).not.toHaveAttribute("lang", "zh");
    await expect(page.locator('a[hreflang="zh"]')).toHaveCount(0);
    await expect(page.locator('a[href="/zh"]')).toHaveCount(0);
    await expect(page.getByText("简体中文")).toHaveCount(0);
    await expect(page.getByText("中文")).toHaveCount(0);
  });

  test("contact page renders inquiry fallback without JavaScript", async ({
    page,
  }) => {
    // 桌面视口显式钉住：断言的是桌面导航（header-desktop-nav），移动视口下它
    // 本来就该隐藏。不钉的话这条用例在 Mobile 项目里必然红。移动端的等价
    // 契约由第 73 行那条 mobile 用例覆盖。
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("http://localhost:3000/contact", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("link", { name: site.skipLabel }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: /main navigation/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: site.contactHeading }),
    ).toBeVisible();

    const html = await page.content();
    expectExactlyOneMain(html);
    expect(html).toContain('id="main-content"');
    expect(html).toContain('data-testid="contact-form-column"');
    expect(html).toContain('data-testid="inquiry-form-static-fallback"');
    expect(html).not.toMatch(/<form[\s>]/);

    const formColumn = page.locator(
      '#main-content [data-testid="contact-form-column"]',
    );
    const staticFallback = formColumn
      .locator('[data-testid="inquiry-form-static-fallback"]:visible')
      .first();

    await expect(staticFallback).toBeVisible();
    await expect(
      staticFallback.getByText(/secure inquiry form needs JavaScript/i),
    ).toBeVisible();
    await expect(
      staticFallback.getByRole("link", { name: /@/i }),
    ).toBeVisible();
    await expect(staticFallback.getByRole("button")).toHaveCount(0);
    await expectNoReservedGap(page);
    await expectBodyRenderedOnce(page);
  });

  test("request quote page renders inquiry fallback without JavaScript", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/request-quote", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", { name: /request a quote|get real numbers/i }),
    ).toBeVisible();

    const html = await page.content();
    expectExactlyOneMain(html);
    expect(html).toContain('data-testid="inquiry-form-static-fallback"');
    expect(html).not.toMatch(/<form[\s>]/);

    const staticFallback = page
      .locator(
        '#main-content [data-testid="inquiry-form-static-fallback"]:visible',
      )
      .first();

    await expect(staticFallback).toBeVisible();
    await expect(
      staticFallback.getByText(/secure inquiry form needs JavaScript/i),
    ).toBeVisible();
    await expect(
      staticFallback.getByRole("link", { name: /@/i }),
    ).toBeVisible();
    await expect(staticFallback.getByRole("button")).toHaveCount(0);
    await expectNoReservedGap(page);
    await expectBodyRenderedOnce(page);
    // Exactly one card in the whole document. Comparing the total against the
    // inside-main count instead would pass on two copies that both sit inside
    // main; an absolute count catches that too.
    await expect(
      page.locator('[data-testid="inquiry-form-static-fallback"]'),
    ).toHaveCount(1);
  });

  test("every canonical public page exposes one composed main landmark", async ({
    page,
  }) => {
    // 16 次无脚本 goto，比原来的 4 次慢；默认 30s 不够，慢一点的浏览器档会超时。
    test.slow();
    // 注册表读空的话，下面这个循环一次都不跑，断言全部真空通过。
    expect(canonicalPublicPaths.length).toBeGreaterThan(0);

    for (const path of canonicalPublicPaths) {
      await page.goto(`http://localhost:3000${path}`, {
        waitUntil: "domcontentloaded",
      });

      expectExactlyOneMain(await page.content());
      await expectBodyRenderedOnce(page);
    }
  });

  test("rendered <title> carries exactly one brand suffix", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/products/aluminum-flood-gates", {
      waitUntil: "domcontentloaded",
    });
    const title = await page.title();
    expect(title).toMatch(/\| Tucsenberg$/u);
    expect(title).not.toMatch(/Tucsenberg\s*\|\s*Tucsenberg/u);
  });
});
