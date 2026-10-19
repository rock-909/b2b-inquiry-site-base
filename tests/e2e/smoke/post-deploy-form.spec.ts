import assert from "node:assert/strict";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { buildCanarySelectors } from "./canary-selectors";
import { isDeployedCanaryUrl } from "./post-deploy-canary-url";

/**
 * Post-Deploy Airtable Write Verification
 * Proof lane: airtable-write-canary
 *
 * This proof submits through the deployed form and verifies the resulting
 * Airtable record. Resend delivery and owner receipt remain separate proofs.
 *
 * Environment variables required:
 * - Run through `pnpm canary:airtable`
 * - STAGING_URL or PLAYWRIGHT_BASE_URL: deployed site URL
 * - AIRTABLE_API_KEY: PAT with read/write access
 * - AIRTABLE_BASE_ID: target base
 * - AIRTABLE_TABLE_NAME: target table (default: "Contacts")
 *
 */

const canaryTargetUrl =
  process.env.STAGING_URL || process.env.PLAYWRIGHT_BASE_URL;
const baseId = process.env.AIRTABLE_BASE_ID;
const apiKey = process.env.AIRTABLE_API_KEY;
const tableName = process.env.AIRTABLE_TABLE_NAME || "Contacts";

assert.equal(
  process.env.POST_DEPLOY_TEST,
  "1",
  "Run the real provider proof with pnpm canary:airtable",
);
assert(
  isDeployedCanaryUrl(canaryTargetUrl),
  "Airtable canary requires a deployed HTTPS STAGING_URL or PLAYWRIGHT_BASE_URL",
);
assert(baseId, "Airtable canary requires AIRTABLE_BASE_ID");
assert(apiKey, "Airtable canary requires AIRTABLE_API_KEY");

interface AirtableInquiryRecordFields {
  "First Name"?: unknown;
  "Last Name"?: unknown;
  Email?: unknown;
  Company?: unknown;
  Interest?: unknown;
  Requirements?: unknown;
  Message?: unknown;
  "Reference ID"?: unknown;
  "UTM Source"?: unknown;
  "UTM Medium"?: unknown;
  "UTM Campaign"?: unknown;
  "UTM Term"?: unknown;
  "UTM Content"?: unknown;
  "Landing Page"?: unknown;
  "Captured At"?: unknown;
}

interface AirtableInquiryRecord {
  id?: string;
  fields?: AirtableInquiryRecordFields;
}

interface AirtableInquiryListResponse {
  records?: AirtableInquiryRecord[];
}

interface InquirySuccessResponse {
  success?: unknown;
  data?: { referenceId?: unknown };
}

const AIRTABLE_BASE_URL = "https://api.airtable.com/v0";

// Attribution is only written when the visit carries UTM params, so the canary
// must arrive with all of them to prove every attribution column exists.
const CANARY_UTM = {
  utm_source: "canary-source",
  utm_medium: "canary-medium",
  utm_campaign: "canary-campaign",
  utm_term: "canary-term",
  utm_content: "canary-content",
};

async function waitForEditableInquiryForm(page: Page) {
  await page.goto(`/contact?${new URLSearchParams(CANARY_UTM)}`);
  await page.waitForLoadState("load");

  // Scroll the shared form into view before checking editability.
  await page
    .getByTestId("contact-form-column")
    .scrollIntoViewIfNeeded({ timeout: 5_000 });

  const fullName = page.locator('input[name="fullName"]');
  await expect(
    fullName,
    "Shared InquiryForm did not become editable on the deployed contact page",
  ).toBeEditable({ timeout: 15_000 });
}

async function submitInquiryForm(page: Page, email: string, message: string) {
  await page.fill('input[name="fullName"]', "Smoke Test");
  await page.fill('input[name="email"]', email);
  await page.fill('textarea[name="message"]', message);

  const inquiryResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/inquiry") &&
      response.request().method() === "POST",
    { timeout: 20000 },
  );
  const selectors = buildCanarySelectors();
  const submitButton = page.getByRole("button", {
    name: selectors.submitLabel,
  });

  // 真实 Turnstile 校验完成前按钮保持禁用，留足时间而不是固定等待。
  await expect(
    submitButton,
    "Submit button stayed disabled on the deployed contact flow",
  ).toBeEnabled({ timeout: 15_000 });

  await submitButton.click();

  return {
    inquiryResponse: await inquiryResponsePromise,
    selectors,
  };
}

async function expectDeployedSuccess(page: Page, successPrefix: string) {
  const successIndicator = page.getByText(successPrefix);
  const errorIndicator = page
    .getByText(/error|failed|try again/i)
    .or(page.getByText(/错误|失败|重试/i));

  const result = await Promise.race([
    successIndicator
      .first()
      .waitFor({ timeout: 15000 })
      .then(() => "success"),
    errorIndicator
      .first()
      .waitFor({ timeout: 15000 })
      .then(() => "error"),
  ]).catch(() => "timeout");

  expect(result, "Deployed contact flow did not reach a success state").toBe(
    "success",
  );
}

const airtableTableUrl = `${AIRTABLE_BASE_URL}/${baseId}/${encodeURIComponent(tableName)}`;
const airtableHeaders = { Authorization: `Bearer ${apiKey}` };

// 接口返回成功前已写完 Airtable，所以无需等待，直接按公式查全部匹配。
async function findCanaryRecords(
  request: APIRequestContext,
  formula: string,
): Promise<AirtableInquiryRecord[]> {
  const airtableResponse = await request.get(airtableTableUrl, {
    headers: airtableHeaders,
    params: { filterByFormula: formula },
  });

  expect(
    airtableResponse.ok(),
    `Airtable lookup failed with HTTP ${airtableResponse.status()}`,
  ).toBe(true);
  const body = (await airtableResponse.json()) as AirtableInquiryListResponse;
  return body.records ?? [];
}

function expectCanaryAttribution(fields?: AirtableInquiryRecordFields) {
  expect(fields?.["UTM Source"]).toBe(CANARY_UTM.utm_source);
  expect(fields?.["UTM Medium"]).toBe(CANARY_UTM.utm_medium);
  expect(fields?.["UTM Campaign"]).toBe(CANARY_UTM.utm_campaign);
  expect(fields?.["UTM Term"]).toBe(CANARY_UTM.utm_term);
  expect(fields?.["UTM Content"]).toBe(CANARY_UTM.utm_content);
  expect(fields?.["Landing Page"]).toBe("/contact");
  expect(
    Number.isNaN(Date.parse(String(fields?.["Captured At"]))),
    "Airtable canary record did not include a valid Captured At",
  ).toBe(false);
}

test.describe("Post-Deploy: Airtable Write Canary", () => {
  const CANARY_EMAIL = `smoke-test+${Date.now()}@example.com`;
  const CANARY_MESSAGE = "Automated post-deploy verification — please ignore";

  test("form submission creates Airtable record with split name and attribution fields", async ({
    page,
    request,
  }) => {
    // 提交前就划定清理边界：Reference ID 由服务端生成，只有邮箱是提前已知的唯一标识。
    const knownRecordIds = new Set<string>();
    let cleanupLookupError: unknown;

    try {
      await waitForEditableInquiryForm(page);
      const { inquiryResponse, selectors } = await submitInquiryForm(
        page,
        CANARY_EMAIL,
        CANARY_MESSAGE,
      );

      expect(
        inquiryResponse.ok(),
        `Inquiry API failed with HTTP ${inquiryResponse.status()}`,
      ).toBe(true);
      const inquiryResult =
        (await inquiryResponse.json()) as InquirySuccessResponse;
      expect(inquiryResult).toMatchObject({
        success: true,
        data: { referenceId: expect.any(String) },
      });
      const referenceId = String(inquiryResult.data?.referenceId);

      const inquiryBody = inquiryResponse.request().postDataJSON() as Record<
        string,
        unknown
      >;
      expect(inquiryBody.email).toBe(CANARY_EMAIL);
      expect(inquiryBody.fullName).toBe("Smoke Test");
      expect(inquiryBody.message).toBe(CANARY_MESSAGE);

      const records = await findCanaryRecords(
        request,
        `{Reference ID}="${referenceId}"`,
      );
      for (const { id } of records) {
        if (typeof id === "string") knownRecordIds.add(id);
      }
      expect(
        records,
        "Exactly one Airtable record must carry the canary Reference ID",
      ).toHaveLength(1);
      const record = records[0];
      expect(record?.fields?.["First Name"]).toBe("Smoke");
      expect(record?.fields?.["Last Name"]).toBe("Test");
      expect(record?.fields?.Email).toBe(CANARY_EMAIL);
      expect(record?.fields?.Requirements).toBe(CANARY_MESSAGE);
      expect(record?.fields?.["Reference ID"]).toBe(referenceId);
      expect(record?.fields?.Company ?? "").toBe("");
      expectCanaryAttribution(record?.fields);

      await expectDeployedSuccess(page, selectors.successPrefix);
    } finally {
      // 按邮箱再查一遍，提交后响应丢失、超时等任一失败路径也能删掉记录；
      // 查询本身失败时仍删除已拿到的 ID，最后再把查询错误抛出。
      try {
        const records = await findCanaryRecords(
          request,
          `{Email}="${CANARY_EMAIL}"`,
        );
        for (const { id } of records) {
          if (typeof id === "string") knownRecordIds.add(id);
        }
      } catch (error) {
        cleanupLookupError = error;
      }
      await Promise.all(
        [...knownRecordIds].map(async (id) => {
          const cleanupResponse = await request.delete(
            `${airtableTableUrl}/${id}`,
            { headers: airtableHeaders },
          );
          expect(
            cleanupResponse.ok(),
            `Airtable canary cleanup failed with HTTP ${cleanupResponse.status()}`,
          ).toBe(true);
        }),
      );
      if (cleanupLookupError) throw cleanupLookupError;
    }
  });
});
