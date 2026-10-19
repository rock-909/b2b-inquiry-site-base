import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
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

// 与 src/lib/airtable/service.ts 的 AIRTABLE_REQUEST_TIMEOUT_MS 保持一致；
// 该模块带 server-only，不能直接导入。
const AIRTABLE_WRITE_CAP_MS = 8_000;
const CLEANUP_MARGIN_MS = 5_000;
const CLEANUP_WINDOW_MS = AIRTABLE_WRITE_CAP_MS + CLEANUP_MARGIN_MS;
const CLEANUP_POLL_INTERVAL_MS = 1_000;
const AIRTABLE_REQUEST_TIMEOUT_MS = 10_000;
const RESPONSE_WAIT_MS = 20_000;
// 表单就绪 50s + 按钮可用 15s + 响应 20s + 成功态 15s + 清理窗口 13s
// + 清理时的查询与删除 20s，再留余量。
const TEST_TIMEOUT_MS = 150_000;

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

// 提交后的服务端状态：点击前未知，点击后才可能写入 Airtable，响应到达后写入必已结束。
interface CanarySubmission {
  submittedAt?: number;
  responded: boolean;
}

async function submitInquiryForm(
  page: Page,
  email: string,
  message: string,
  submission: CanarySubmission,
) {
  await page.fill('input[name="fullName"]', "Smoke Test");
  await page.fill('input[name="email"]', email);
  await page.fill('textarea[name="message"]', message);

  const selectors = buildCanarySelectors();
  const submitButton = page.getByRole("button", {
    name: selectors.submitLabel,
  });

  // 真实 Turnstile 校验完成前按钮保持禁用，留足时间而不是固定等待。
  await expect(
    submitButton,
    "Submit button stayed disabled on the deployed contact flow",
  ).toBeEnabled({ timeout: 15_000 });

  // 响应计时从点击前才开始，等按钮的时间不能占掉响应预算。
  const inquiryResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/inquiry") &&
      response.request().method() === "POST",
    { timeout: RESPONSE_WAIT_MS },
  );
  submission.submittedAt = Date.now();
  await submitButton.click();

  const inquiryResponse = await inquiryResponsePromise;
  submission.responded = true;
  return { inquiryResponse, selectors };
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
    timeout: AIRTABLE_REQUEST_TIMEOUT_MS,
  });

  expect(
    airtableResponse.ok(),
    `Airtable lookup failed with HTTP ${airtableResponse.status()}`,
  ).toBe(true);
  const body = (await airtableResponse.json()) as AirtableInquiryListResponse;
  return body.records ?? [];
}

// 提交后结果未知时（没拿到响应），服务端写入最迟在 8s 上限后落地，所以在窗口内
// 反复按邮箱查并删除；空结果不代表清理完成。已拿到响应则写入已结束，查一遍即可。
async function cleanupCanaryRecords(
  request: APIRequestContext,
  email: string,
  submission: CanarySubmission,
  knownRecordIds: Set<string>,
) {
  const failures: unknown[] = [];
  const attempted = new Set<string>();
  const deadline = (submission.submittedAt ?? Date.now()) + CLEANUP_WINDOW_MS;

  do {
    try {
      for (const { id } of await findCanaryRecords(
        request,
        `{Email}="${email}"`,
      )) {
        if (typeof id === "string") knownRecordIds.add(id);
      }
    } catch (error) {
      failures.push(error);
    }

    await Promise.all(
      [...knownRecordIds]
        .filter((id) => !attempted.has(id))
        .map(async (id) => {
          attempted.add(id);
          try {
            const cleanupResponse = await request.delete(
              `${airtableTableUrl}/${id}`,
              {
                headers: airtableHeaders,
                timeout: AIRTABLE_REQUEST_TIMEOUT_MS,
              },
            );
            expect(
              cleanupResponse.ok(),
              `Airtable canary cleanup failed with HTTP ${cleanupResponse.status()}`,
            ).toBe(true);
          } catch (error) {
            failures.push(error);
          }
        }),
    );

    if (submission.responded || submission.submittedAt === undefined) break;
    await sleep(CLEANUP_POLL_INTERVAL_MS);
  } while (Date.now() < deadline);

  if (failures.length > 0) throw failures[0];
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
    test.setTimeout(TEST_TIMEOUT_MS);
    // 提交前就划定清理边界：Reference ID 由服务端生成，只有邮箱是提前已知的唯一标识。
    const knownRecordIds = new Set<string>();
    const submission: CanarySubmission = { responded: false };

    try {
      await waitForEditableInquiryForm(page);
      const { inquiryResponse, selectors } = await submitInquiryForm(
        page,
        CANARY_EMAIL,
        CANARY_MESSAGE,
        submission,
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
      await cleanupCanaryRecords(
        request,
        CANARY_EMAIL,
        submission,
        knownRecordIds,
      );
    }
  });
});
