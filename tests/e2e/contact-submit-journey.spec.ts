import { expect, test, type Page } from "@playwright/test";
import { buildCanarySelectors } from "./smoke/canary-selectors";
import { checkA11y } from "./helpers/axe";
import { checkedInquiryStub } from "../helpers/inquiry-contract";

test("buyer fills contact form, clicks submit, sees success", async ({
  page,
}) => {
  const selectors = buildCanarySelectors();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/api/inquiry", (route) =>
    route.fulfill(
      checkedInquiryStub({
        status: 200,
        body: {
          success: true,
          data: { referenceId: "e2e-ref-1" },
        },
      }),
    ),
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
  expect(pageErrors).toStrictEqual([]);
});

test("buyer retries a failed inquiry without losing the draft", async ({
  page,
}) => {
  const selectors = buildCanarySelectors();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const submissions: unknown[] = [];
  const draft = {
    fullName: "Retry Buyer",
    email: "retry@example.com",
    message: "Please quote 500 units for our next shipment.",
  };

  // 仅替换 API 响应；保留真实表单、草稿和 test-mode 控件重置链路。
  await page.route("**/api/inquiry", async (route) => {
    submissions.push(route.request().postDataJSON());
    await route.fulfill(
      checkedInquiryStub(
        submissions.length === 1
          ? {
              status: 500,
              body: { success: false, errorCode: "INQUIRY_PROCESSING_ERROR" },
            }
          : {
              status: 200,
              body: { success: true, data: { referenceId: "e2e-retry-ref" } },
            },
      ),
    );
  });
  await page.goto("/contact");
  const form = page.getByTestId("inquiry-form");
  await form.scrollIntoViewIfNeeded();
  const fullName = form.getByLabel(/^full name/i);
  const email = form.getByLabel(/^email address/i);
  const message = form.getByLabel(/message/i);
  await fullName.fill(draft.fullName);
  await email.fill(draft.email);
  await message.fill(draft.message);
  const submit = form.getByRole("button", { name: selectors.submitLabel });
  await expect(submit).toBeEnabled();
  await submit.click();

  const serverError = form.getByText(
    "We could not send your inquiry right now. Please try again shortly.",
  );
  await expect(serverError).toBeVisible();
  await expect(form.getByText(selectors.successPrefix)).toHaveCount(0);
  await expect(fullName).toHaveValue(draft.fullName);
  await expect(email).toHaveValue(draft.email);
  await expect(message).toHaveValue(draft.message);
  expect(submissions).toHaveLength(1);

  // 不刷新、不手工注入令牌：控件必须自行恢复，买家才能原页重试。
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(form.getByText(selectors.successPrefix)).toBeVisible();
  await expect(form.getByText(/e2e-retry-ref/)).toBeVisible();
  await expect(serverError).toHaveCount(0);
  expect(submissions).toHaveLength(2);
  for (const submission of submissions) {
    expect(submission).toMatchObject(draft);
  }
  await expect(fullName).toHaveValue("");
  await expect(email).toHaveValue("");
  await expect(message).toHaveValue("");

  // 成功后再次访问也不能恢复旧询盘，避免只清空 DOM 却留下会话草稿。
  await page.reload();
  await form.scrollIntoViewIfNeeded();
  await expect(fullName).toBeEditable();
  await expect(fullName).toHaveValue("");
  await expect(email).toHaveValue("");
  await expect(message).toHaveValue("");
  expect(pageErrors).toEqual([]);
});

async function expectAccessibleServerFieldErrors(page: Page, path: string) {
  const selectors = buildCanarySelectors();
  await page.route("**/api/inquiry", (route) =>
    route.fulfill(
      checkedInquiryStub({
        status: 400,
        body: {
          success: false,
          errorCode: "INQUIRY_VALIDATION_FAILED",
          details: [
            "errors.fullName.invalid",
            "errors.email.invalid",
            "errors.message.tooLong",
            "errors.unregistered.invalid",
          ],
        },
      }),
    ),
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

for (const path of ["/contact"] as const) {
  test(`server field errors on ${path} keep the summary and expose accessible field details`, async ({
    page,
  }) => {
    await expectAccessibleServerFieldErrors(page, path);
  });
}

for (const failure of ["turnstile", "rate-limit"] as const) {
  test(`${failure} rejection preserves the draft and permits only a manual retry`, async ({
    page,
  }) => {
    const selectors = buildCanarySelectors();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const submissions: unknown[] = [];
    const rejected = checkedInquiryStub(
      failure === "turnstile"
        ? {
            status: 400,
            body: { success: false, errorCode: "TURNSTILE_REJECTED" },
          }
        : {
            status: 429,
            headers: { "Retry-After": "2" },
            body: { success: false, errorCode: "RATE_LIMIT_EXCEEDED" },
          },
    );
    const accepted = checkedInquiryStub({
      status: 200,
      body: {
        success: true,
        data: { referenceId: "e2e-recovered-ref" },
      },
    });
    await page.route("**/api/inquiry", async (route) => {
      submissions.push(route.request().postDataJSON());
      await route.fulfill(submissions.length === 1 ? rejected : accepted);
    });
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    await page.goto("/contact");
    const form = page.getByTestId("inquiry-form");
    await form.scrollIntoViewIfNeeded();
    const [fullName, email, message] = [
      form.getByLabel(/^full name/i),
      form.getByLabel(/^email address/i),
      form.getByLabel(/message/i),
    ] as const;
    const draft = {
      fullName: "Recovery Buyer",
      email: "recover@example.com",
      message: "Please quote our next order.",
    };
    await fullName.fill(draft.fullName);
    await email.fill(draft.email);
    await message.fill(draft.message);
    const submit = form.getByRole("button", { name: selectors.submitLabel });
    await expect(submit).toBeEnabled();
    // 控件就绪后固定时钟，避免自动时间流逝掩盖两秒冷却门控。
    await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
    await submit.click();
    const summary = form.getByText(
      failure === "turnstile"
        ? "Security verification did not complete. Please try again."
        : "Too many attempts. Please wait before sending your inquiry again.",
    );
    await expect(summary).toBeVisible();
    await expect(form.getByText(selectors.successPrefix)).toHaveCount(0);
    await expect(fullName).toHaveValue(draft.fullName);
    await expect(email).toHaveValue(draft.email);
    await expect(message).toHaveValue(draft.message);
    if (failure === "rate-limit") {
      await expect(submit).toBeDisabled();
      await page.clock.runFor(1000);
      await expect(submit).toBeDisabled();
      await fullName.press("Enter");
      expect(submissions).toHaveLength(1);
      await page.clock.runFor(1000);
      await expect(
        form.getByText("You can send your inquiry again now."),
      ).toBeVisible();
    } else {
      // 只推进控件自身的恢复定时器，不写入 token，也不刷新页面。
      await page.clock.runFor(1000);
    }
    await expect(submit).toBeEnabled();
    expect(submissions).toHaveLength(1);
    await submit.click();
    await expect(form.getByText(/e2e-recovered-ref/)).toBeVisible();
    await expect(summary).toHaveCount(0);
    expect(submissions).toHaveLength(2);
    for (const submission of submissions) {
      expect(submission).toMatchObject({
        ...draft,
        turnstileToken: expect.any(String),
      });
    }
    await page.reload();
    await form.scrollIntoViewIfNeeded();
    await expect(fullName).toBeEditable();
    for (const field of [fullName, email, message]) {
      await expect(field).toHaveValue("");
    }
    expect(pageErrors).toEqual([]);
  });
}

for (const path of ["/contact"] as const) {
  test(`server field errors on a short mobile viewport keep the first invalid field visible and focused on ${path}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await expectAccessibleServerFieldErrors(page, path);
  });
}
