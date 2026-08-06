import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // @ts-expect-error - inject test Turnstile site key for Playwright runs
    window.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
  });
});

test("product CTA reaches RFQ with validated catalog identity", async ({
  page,
}) => {
  let submittedBody: Record<string, unknown> | undefined;

  await page.route("**/api/inquiry", async (route) => {
    submittedBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { referenceId: "nightly-rfq-1" },
      }),
    });
  });

  await page.goto("/products/frp-flood-barriers", {
    waitUntil: "domcontentloaded",
  });

  const interestLink = page
    .getByRole("link", {
      exact: true,
      name: "Register interest",
    })
    .first();
  await expect(interestLink).toHaveAttribute(
    "href",
    "/request-quote?catalogProductId=frp-flood-barriers",
  );

  await interestLink.click();
  await expect(page).toHaveURL(
    /\/request-quote\?catalogProductId=frp-flood-barriers$/,
  );

  const form = page.locator('form[data-lead-path="api-inquiry"]');
  await form.scrollIntoViewIfNeeded();
  await expect(page.getByTestId("inquiry-form")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByTestId("inquiry-buyer-interest-context"),
  ).toContainText("FRP Composite Planks");
  await form.locator('[name="fullName"]').fill("Nightly Buyer");
  await form.locator('[name="email"]').fill("nightly@example.com");
  await form.locator('[name="message"]').fill("Need FRP barrier details.");

  await expect(page.getByTestId("turnstile-mock")).toBeVisible({
    timeout: 15_000,
  });

  const submit = form.locator('button[type="submit"]');
  await expect(submit).toBeEnabled({ timeout: 15_000 });
  await submit.click();

  await expect(form.getByRole("status")).toContainText("nightly-rfq-1");
  expect(submittedBody).toMatchObject({
    productInquiryKind: "catalog-product",
    catalogProductId: "frp-flood-barriers",
    message: "Need FRP barrier details.",
  });
  await expect(form.locator('[name="fullName"]')).toHaveValue("");
  await expect(form.locator('[name="email"]')).toHaveValue("");
  await expect(form.locator('[name="message"]')).toHaveValue("");
});

test("general request quote does not carry a catalog product identity", async ({
  page,
}) => {
  let submittedBody: Record<string, unknown> | undefined;

  await page.route("**/api/inquiry", async (route) => {
    submittedBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { referenceId: "nightly-rfq-general" },
      }),
    });
  });

  await page.goto("/request-quote", { waitUntil: "domcontentloaded" });

  const form = page.locator('form[data-lead-path="api-inquiry"]');
  await expect(page.getByTestId("inquiry-form")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId("inquiry-buyer-interest-context")).toHaveCount(
    0,
  );

  await form.locator('[name="fullName"]').fill("General Buyer");
  await form.locator('[name="email"]').fill("general@example.com");
  await form.locator('[name="message"]').fill("Need a general quote.");

  await expect(page.getByTestId("turnstile-mock")).toBeVisible({
    timeout: 15_000,
  });

  const submit = form.locator('button[type="submit"]');
  await expect(submit).toBeEnabled({ timeout: 15_000 });
  await submit.click();

  await expect(form.getByRole("status")).toContainText("nightly-rfq-general");
  expect(submittedBody).toMatchObject({
    productInquiryKind: "general-rfq",
    message: "Need a general quote.",
  });
  expect(submittedBody).not.toHaveProperty("catalogProductId");
});
