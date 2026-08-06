import { expect, test, type Page, type TestInfo } from "@playwright/test";

/**
 * Contact Form Smoke Tests - Test Mode
 * Proof lane: local/test-mode
 *
 * 这是本地/CI 的 test-mode smoke：
 * - 允许使用 Playwright 注入的测试环境与 Turnstile 测试路径
 * - 用来验证联系页表单的字段合约和 JS 分支可用性
 * - 不是生产态最终证明；真实提交链路由 post-deploy smoke 负责
 *
 * 2026-07-29 从 15 条收到 3 条。删掉的分四类：
 *
 * 1. 跨文件重复：中文入口缺席和 `/zh/contact` 404 在
 *    `tucsenberg-site-smoke.spec.ts` 里已经逐条守着（那边还多守 `/zh` 本身）。
 * 2. 被更强的检查覆盖：移动端那条只断言「表单可见」，而
 *    `layout-stability.spec.ts` 在 360/412/640/768px 四档验证真实表单可见且不抖，
 *    `core-page-visual-calibration.spec.ts` 还在 390px 断言无横向溢出。
 *    大屏那条留下了，理由见下面的用例注释。
 * 3. 挡不住任何东西的门：「加载时间 < 5 秒」是墙钟阈值，慢的时候红的是 CI 不是站点；
 *    「失败请求少于 3 个」等于明说可以挂掉两个 JS/CSS。
 * 4. 文件内重复：字段渲染、必填属性、标签、输入类型原来散在五条里，合并成一条
 *    字段合约；两条「填完表单」用例合并成一条，并把原来的
 *    `waitForTimeout(2000)` 换成对提交按钮变为可用的等待。
 *
 * 另外删掉了两处 `if (await privacyCheckbox.isVisible())` 的空转分支：隐私改成了
 * 提交按钮旁的声明式文案，页面上一个 checkbox 都没有，那两段 if 从来没进去过。
 */

// Contact 页面较重，在完整 E2E + 4 workers 下容易在高峰期超时，
// 这里将本文件内用例串行执行，降低瞬时负载。
test.describe.configure({ mode: "serial" });

test.describe("Contact Form - Test-Mode Smoke", () => {
  const expectedContactTitle = /Contact Tucsenberg/i;

  const resolveContactUrl = (info: TestInfo): string => {
    const base =
      process.env.STAGING_URL ||
      info.project?.use?.baseURL ||
      process.env.PLAYWRIGHT_BASE_URL ||
      "http://localhost:3000";

    try {
      return new URL("/contact", base).toString();
    } catch {
      return `${base.replace(/\/$/, "")}/contact`;
    }
  };

  const gotoContactPage = async (page: Page, info: TestInfo): Promise<void> => {
    await page.goto(resolveContactUrl(info), {
      waitUntil: "domcontentloaded",
    });

    await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => {});

    // Progressive enhancement: scroll the form column into view so InquiryForm
    // and LazyTurnstile can mount before interaction.
    await page
      .getByTestId("contact-form-column")
      .scrollIntoViewIfNeeded({ timeout: 10_000 });

    await expect(page.locator('input[name="fullName"]').first()).toBeEditable({
      timeout: 15_000,
    });
    await expect(page).toHaveTitle(expectedContactTitle);
  };

  test.beforeEach(async ({ page }) => {
    // 设置 Turnstile 测试密钥
    await page.addInitScript(() => {
      // @ts-expect-error - 注入测试环境变量
      window.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
    });
  });

  // 字段名、输入类型和必填性是询盘链路的入口合约：这些值同时决定了买家看到什么、
  // 浏览器怎么校验、以及 FormData 提交给 /api/inquiry 的键名。
  test("ships the inquiry field contract buyers actually submit", async ({
    page,
  }) => {
    await gotoContactPage(page, test.info());

    const fullNameInput = page.getByLabel(/^full name/i);
    await expect(fullNameInput).toHaveAttribute("name", "fullName");
    await expect(fullNameInput).toHaveAttribute("type", "text");
    // 用单参形式断言「属性在不在」。带值的 `toHaveAttribute("required", "")` 比的是
    // 属性值，`required="required"` 这种合法写法会让否定断言假绿。
    await expect(fullNameInput).toHaveAttribute("required");

    const emailInput = page.getByLabel(/^email address/i);
    await expect(emailInput).toHaveAttribute("name", "email");
    await expect(emailInput).toHaveAttribute("type", "email");
    await expect(emailInput).toHaveAttribute("required");

    // message 是选填的：把它变成必填会拦掉只想留联系方式的买家。
    const messageInput = page.getByLabel(/message/i);
    await expect(messageInput).toHaveAttribute("name", "message");
    await expect(messageInput).not.toHaveAttribute("required");

    // 隐私是提交按钮旁的声明式文案，不是复选框；company 字段已退役。
    const privacyNotice = page.getByTestId("form-privacy-notice");
    await expect(privacyNotice).toBeVisible();
    await expect(privacyNotice).toContainText(/privacy policy/i);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.locator('input[name="company"]')).toHaveCount(0);
  });

  // test-mode 下 Turnstile 走 dummy token 分支。这条守的是「买家最终能提交」：
  // 按钮从禁用变可用，说明 token 真的回来了，而不是页面停在等验证的状态。
  test("enables submit once the test-mode bot check resolves", async ({
    page,
  }) => {
    await gotoContactPage(page, test.info());

    const form = page.locator("form").first();
    await expect(
      form.getByText("Bot protection disabled in test mode"),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: /send inquiry|submit/i }),
    ).toBeEnabled({ timeout: 15_000 });
  });

  // 1920px 这条不能并进别的文件：`layout-stability.spec.ts` 最宽只到 768px，
  // `core-page-visual-calibration.spec.ts` 的桌面档是 1440px，都没到 Tailwind `2xl`
  // 的 1536px。给表单容器加一个 `2xl:hidden`，上面所有检查都还是绿的，而 1536px 以上
  // 的买家看不到询盘表单。
  test("keeps the inquiry form visible past the 2xl breakpoint", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await gotoContactPage(page, test.info());

    await expect(page.getByTestId("inquiry-form")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /send inquiry|submit/i }),
    ).toBeVisible();
  });

  // 联系页有两套表单：JS 到位时的 InquiryForm，和无 JS 时的静态备用壳子
  // （`inquiry-form-static-fallback.tsx`）。这条守的是 JS 分支真的接管了——壳子的
  // 输入框填不进值。无 JS 分支归 `no-js-html-contract.spec.ts`。
  // 原注释里的 BC-008 在仓库里已经没有对应条目了，所以直接写行为，不写编号。
  test("keeps the real form editable instead of the static fallback", async ({
    page,
  }) => {
    await gotoContactPage(page, test.info());

    await page.fill('input[name="fullName"]', "John Doe");
    await page.fill('input[name="email"]', "john.doe@example.com");
    await page.fill(
      'textarea[name="message"]',
      "This is a test message from E2E tests.",
    );

    await expect(page.locator('input[name="fullName"]')).toHaveValue(
      "John Doe",
    );
    await expect(page.locator('input[name="email"]')).toHaveValue(
      "john.doe@example.com",
    );
    await expect(page.locator('textarea[name="message"]')).toHaveValue(
      "This is a test message from E2E tests.",
    );
  });
});
