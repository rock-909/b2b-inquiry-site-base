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
  // LazyTurnstile can mount before submit.
  await page
    .getByTestId("contact-form-column")
    .scrollIntoViewIfNeeded({ timeout: 5_000 });

  const fullName = page.locator('input[name="fullName"]');
  await expect(fullName).toBeEditable({ timeout: 15_000 });

  await fullName.fill("E2E Buyer");
  await page.locator('input[name="email"]').fill("buyer@example.com");

  // LazyTurnstile mounts after idle/IO; wait for the test-mode token to settle.
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
