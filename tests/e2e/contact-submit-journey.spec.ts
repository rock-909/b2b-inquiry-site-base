import { expect, test, type Page } from "@playwright/test";
import { buildCanarySelectors } from "./smoke/canary-selectors";
import { checkA11y } from "./helpers/axe";

test("buyer fills contact form, clicks submit, sees success", async ({
  page,
}) => {
  const selectors = buildCanarySelectors();
  await page.route("**/api/inquiry", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { referenceId: "e2e-ref-1" },
      }),
    }),
  );
  await page.goto("/contact");

  // Contact renders InquiryForm directly — scroll the form column into view so
  // Turnstile test mode can settle before submit.
  await page
    .getByTestId("contact-form-column")
    .scrollIntoViewIfNeeded({ timeout: 5_000 });

  const fullName = page.locator('input[name="fullName"]');
  await expect(fullName).toBeEditable({ timeout: 15_000 });

  await fullName.fill("E2E Buyer");
  await page.locator('input[name="email"]').fill("buyer@example.com");

  // Wait for the test-mode token to settle.
  await expect(page.getByTestId("turnstile-mock")).toBeVisible({
    timeout: 15_000,
  });

  const submit = page.getByRole("button", { name: selectors.submitLabel });
  await expect(submit).toBeEnabled({ timeout: 15_000 });
  await submit.click();
  await expect(page.getByText(selectors.successPrefix)).toBeVisible();
  await expect(fullName).toHaveValue("");
  await expect(page.locator('input[name="email"]')).toHaveValue("");
  await expect(page.locator('textarea[name="message"]')).toHaveValue("");
});

async function expectAccessibleServerFieldErrors(page: Page, path: string) {
  const selectors = buildCanarySelectors();
  await page.route("**/api/inquiry", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        errorCode: "INQUIRY_VALIDATION_FAILED",
        details: [
          "errors.fullName.invalid",
          "errors.email.invalid",
          "errors.message.tooLong",
          "errors.unregistered.invalid",
        ],
      }),
    }),
  );
  await page.goto(path);

  if (path === "/contact") {
    await page
      .getByTestId("contact-form-column")
      .scrollIntoViewIfNeeded({ timeout: 5_000 });
  }

  const form = page.locator('form[data-lead-path="api-inquiry"]');
  await form.scrollIntoViewIfNeeded({ timeout: 15_000 });
  const fullName = form.locator('input[name="fullName"]');
  const email = form.locator('input[name="email"]');
  const message = form.locator('textarea[name="message"]');
  await expect(fullName).toBeEditable({ timeout: 15_000 });
  await fullName.fill("E2E Buyer");
  await email.fill("buyer@example.com");
  await message.fill("Buyer requirements");

  await expect(page.getByTestId("turnstile-mock")).toBeVisible({
    timeout: 15_000,
  });
  const submit = form.getByRole("button", { name: selectors.submitLabel });
  await expect(submit).toBeEnabled({ timeout: 15_000 });
  await submit.click();

  await expect(
    page.getByText("Please review the highlighted fields and try again."),
  ).toBeVisible();
  await expect(
    page.getByText("Full name contains invalid characters"),
  ).toBeVisible();
  await expect(
    page.getByText("Please enter a valid email address"),
  ).toBeVisible();
  await expect(
    page.getByText("Message must be 2000 characters or fewer"),
  ).toBeVisible();
  await expect(page.getByText("errors.unregistered.invalid")).toHaveCount(0);

  await expect(fullName).toHaveAttribute("aria-invalid", "true");
  await expect(fullName).toHaveAttribute(
    "aria-describedby",
    "inquiry-full-name-error",
  );
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAttribute(
    "aria-describedby",
    "inquiry-email-error",
  );
  await expect(message).toHaveAttribute("aria-invalid", "true");
  await expect(message).toHaveAttribute(
    "aria-describedby",
    "inquiry-message-hint inquiry-message-error",
  );

  // 焦点管理合同：服务端字段错误后，第一个无效字段获得焦点，且必须完整落在
  // 视口内（不被 sticky header 遮挡、不滚出屏幕）。jsdom 组件测试只能证明
  // focus 接线，真实视口滚动只能在这里证明。
  await expect(fullName).toBeFocused();
  const errorFieldBox = await fullName.boundingBox();
  expect(
    errorFieldBox,
    "error field must be laid out inside the viewport",
  ).not.toBeNull();
  expect(errorFieldBox!.y).toBeGreaterThanOrEqual(0);
  expect(errorFieldBox!.y + errorFieldBox!.height).toBeLessThanOrEqual(
    page.viewportSize()?.height ?? Number.POSITIVE_INFINITY,
  );

  // sticky header 遮挡证明：header 是 sticky top-0，量它的真实底边，
  // 错误字段顶部不得高于该值。
  // 页面内容区也有语义 header（文章头），sticky 顶栏是唯一的 banner 角色。
  const headerBox = await page.getByRole("banner").boundingBox();
  expect(headerBox, "sticky header must be measurable").not.toBeNull();
  expect(errorFieldBox!.y).toBeGreaterThanOrEqual(
    headerBox!.y + headerBox!.height,
  );

  await checkA11y(page, 'form[data-lead-path="api-inquiry"]', {
    includedImpacts: ["critical", "serious"],
  });
}

for (const path of ["/contact", "/request-quote"] as const) {
  test(`server field errors on ${path} keep the summary and expose accessible field details`, async ({
    page,
  }) => {
    await expectAccessibleServerFieldErrors(page, path);
  });
}

for (const path of ["/contact", "/request-quote"] as const) {
  test(`server field errors on a short mobile viewport keep the first invalid field visible and focused on ${path}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await expectAccessibleServerFieldErrors(page, path);
  });
}
