import { expect, test, type Page, type TestInfo } from "@playwright/test";

/**
 * Contact Form Smoke Tests - Test Mode
 * Proof lane: local/test-mode
 *
 * 这是本地/CI 的 test-mode smoke，只留其他地方没有的两条：
 * - 提交按钮旁的隐私声明（没有 checkbox）；
 * - 2xl 断点以上表单仍可见。
 * 字段合约归 `inquiry-form.test.tsx`；可编辑、可提交归 `contact-submit-journey.spec.ts`；
 * 320–1280px 的可见与不抖归 `turnstile-layout.spec.ts`。真实提交链路由 post-deploy smoke 负责。
 */

// Contact 页面较重，在完整 E2E + 4 workers 下容易在高峰期超时，
// 这里将本文件内用例串行执行，降低瞬时负载。
test.describe.configure({ mode: "serial" });

test.describe("Contact Form - Test-Mode Smoke", () => {
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

    // Progressive enhancement: scroll the form column into view so InquiryForm
    // and Turnstile test mode can settle before interaction.
    await page
      .getByTestId("contact-form-column")
      .scrollIntoViewIfNeeded({ timeout: 10_000 });

    await expect(page.locator('input[name="fullName"]').first()).toBeEditable({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  };

  // 隐私是提交按钮旁的声明式文案，不是复选框。
  test("shows the privacy notice beside submit without a consent checkbox", async ({
    page,
  }) => {
    await gotoContactPage(page, test.info());

    const privacyNotice = page.getByTestId("form-privacy-notice");
    await expect(privacyNotice).toBeVisible();
    await expect(privacyNotice).toContainText(/privacy policy/i);
    // 只查询询盘表单：Cookie 横幅自带分类复选框，不属于提交同意。
    await expect(
      page.getByTestId("inquiry-form").getByRole("checkbox"),
    ).toHaveCount(0);
  });

  // 1920px 这条不能并进别的文件：`turnstile-layout.spec.ts` 最宽只到 1280px，
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
});
