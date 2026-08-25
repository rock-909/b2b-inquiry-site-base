import { expect, test } from "@playwright/test";
import { buildCanarySelectors } from "./smoke/canary-selectors";

/**
 * 内嵌表单面（首页内容区 / 产品详情页）的转化 journey。
 * 表单行为本身（校验/错误反馈/Turnstile 生命周期）由 contact-submit-journey
 * 与组件测试证明；这里证明的是「嵌入正确 + 产品语境预填 + 锚点可达」。
 */

test("product page CTA anchors to #inquiry with prefilled product context", async ({
  page,
}) => {
  const selectors = buildCanarySelectors();
  await page.route("**/api/inquiry", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { referenceId: "e2e-ref-product" },
      }),
    }),
  );
  await page.goto("/products/sample-offering");

  // SSR 外层 section 携带锚点 id：无 JS 也能定位。
  const section = page.locator("section#inquiry");
  await expect(section).toBeAttached();

  const cta = page.getByRole("link", { name: "Get a quote" });
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", "#inquiry");
  await cta.click();
  await expect(page).toHaveURL(/#inquiry$/);

  // 区块标题带产品语境；message 已按模板预填且可修改。
  await expect(
    section.getByRole("heading", { name: "Inquire about Sample Offering" }),
  ).toBeVisible();

  const fullName = page.locator('input[name="fullName"]');
  const message = page.locator('textarea[name="message"]');
  await expect(fullName).toBeEditable({ timeout: 15_000 });
  await expect(message).toHaveValue("I'm interested in Sample Offering.");

  // 预填可被买家改写：清空后照常提交成功。
  await message.fill("");
  await fullName.fill("E2E Buyer");
  await page.locator('input[name="email"]').fill("buyer@example.com");

  await expect(page.getByTestId("turnstile-mock")).toBeVisible({
    timeout: 15_000,
  });

  const submit = page.getByRole("button", { name: selectors.submitLabel });
  await expect(submit).toBeEnabled({ timeout: 15_000 });
  await submit.click();
  await expect(page.getByText(selectors.successPrefix)).toBeVisible();
});

test("home content section embeds a working inquiry form", async ({ page }) => {
  const selectors = buildCanarySelectors();
  await page.route("**/api/inquiry", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { referenceId: "e2e-ref-home" },
      }),
    }),
  );
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Have a requirement to discuss?",
    }),
  ).toBeVisible();

  // 首页无产品语境：message 必须为空，不得误带预填。
  const message = page.locator('textarea[name="message"]');
  await expect(message).toHaveValue("");

  const fullName = page.locator('input[name="fullName"]');
  await expect(fullName).toBeEditable({ timeout: 15_000 });
  await fullName.fill("Home Buyer");
  await page.locator('input[name="email"]').fill("home@example.com");
  await message.fill("General inquiry from the homepage.");

  await expect(page.getByTestId("turnstile-mock")).toBeVisible({
    timeout: 15_000,
  });

  const submit = page.getByRole("button", { name: selectors.submitLabel });
  await expect(submit).toBeEnabled({ timeout: 15_000 });
  await submit.click();
  await expect(page.getByText(selectors.successPrefix)).toBeVisible();
});
