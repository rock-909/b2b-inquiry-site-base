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
 * - POST_DEPLOY_TEST=1: explicit opt-in for the real deployed canary
 * - STAGING_URL or PLAYWRIGHT_BASE_URL: deployed site URL
 * - AIRTABLE_API_KEY: PAT with read/write access
 * - AIRTABLE_BASE_ID: target base
 * - AIRTABLE_TABLE_NAME: target table (default: "Contacts")
 *
 * Skip policy:
 * - Owner: release proof / launch owner.
 * - Tracking: docs/正式上线标准.md airtable-write-canary lane.
 * - Expiry: none. This is a permanent manual launch gate, not a temporary skip.
 */

const canaryTargetUrl =
  process.env.STAGING_URL || process.env.PLAYWRIGHT_BASE_URL;

// Skip this test unless an explicit deployed target is provided.
const isPostDeploy =
  process.env.POST_DEPLOY_TEST === "1" && isDeployedCanaryUrl(canaryTargetUrl);

interface AirtableInquiryRecordFields {
  "First Name"?: unknown;
  "Last Name"?: unknown;
  Email?: unknown;
  Company?: unknown;
  "Product Name"?: unknown;
  Requirements?: unknown;
  Message?: unknown;
  "Reference ID"?: unknown;
}

interface AirtableInquiryRecord {
  id?: string;
  fields?: AirtableInquiryRecordFields;
}

interface AirtableInquiryListResponse {
  records?: AirtableInquiryRecord[];
}

const GENERAL_RFQ_PRODUCT_LABEL = "General RFQ (no catalog product)";
const AIRTABLE_BASE_URL = "https://api.airtable.com/v0";

async function waitForEditableInquiryForm(page: Page) {
  await page.goto("/contact");
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
  await page.waitForTimeout(3000);

  const inquiryRequestPromise = page.waitForRequest(
    (req) => req.url().includes("/api/inquiry") && req.method() === "POST",
    { timeout: 20000 },
  );
  const selectors = buildCanarySelectors();
  const submitButton = page.getByRole("button", {
    name: selectors.submitLabel,
  });

  await expect(
    submitButton,
    "Submit button stayed disabled on the deployed contact flow",
  ).toBeEnabled();

  await submitButton.click();

  return {
    inquiryRequest: await inquiryRequestPromise,
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

async function fetchAirtableRecord(
  request: APIRequestContext,
  params: { baseId: string; apiKey: string; email: string; tableName: string },
) {
  await new Promise((resolve) => {
    setTimeout(resolve, 5000);
  });

  const airtableResponse = await request.get(
    `${AIRTABLE_BASE_URL}/${params.baseId}/${encodeURIComponent(params.tableName)}`,
    {
      headers: { Authorization: `Bearer ${params.apiKey}` },
      params: {
        filterByFormula: `{Email}="${params.email}"`,
        maxRecords: "1",
      },
    },
  );

  expect(airtableResponse.ok()).toBe(true);
  const body = (await airtableResponse.json()) as AirtableInquiryListResponse;
  expect(body.records?.length ?? 0).toBeGreaterThanOrEqual(1);
  return body.records?.[0];
}

test.describe("Post-Deploy: Airtable Write Canary", () => {
  test.skip(
    !isPostDeploy,
    "Only runs in post-deploy mode (set POST_DEPLOY_TEST=1)",
  );

  const CANARY_EMAIL = `smoke-test+${Date.now()}@example.com`;
  const CANARY_MESSAGE = "Automated post-deploy verification — please ignore";

  test("form submission creates Airtable record with split name fields", async ({
    page,
    request,
  }) => {
    const baseId = process.env.AIRTABLE_BASE_ID;
    const apiKey = process.env.AIRTABLE_API_KEY;
    const tableName = process.env.AIRTABLE_TABLE_NAME || "Contacts";

    test.skip(
      !baseId || !apiKey,
      "Missing AIRTABLE_BASE_ID or AIRTABLE_API_KEY",
    );
    assert(baseId);
    assert(apiKey);

    await waitForEditableInquiryForm(page);
    const { inquiryRequest, selectors } = await submitInquiryForm(
      page,
      CANARY_EMAIL,
      CANARY_MESSAGE,
    );

    const inquiryBody = inquiryRequest.postDataJSON() as Record<
      string,
      unknown
    >;
    expect(inquiryBody.email).toBe(CANARY_EMAIL);
    expect(inquiryBody.fullName).toBe("Smoke Test");
    expect(inquiryBody.message).toBe(CANARY_MESSAGE);
    expect(inquiryBody.productInquiryKind).toBe("general-rfq");

    await expectDeployedSuccess(page, selectors.successPrefix);

    const record = await fetchAirtableRecord(request, {
      baseId,
      apiKey,
      email: CANARY_EMAIL,
      tableName,
    });

    expect(record?.fields?.["First Name"]).toBe("Smoke");
    expect(record?.fields?.["Last Name"]).toBe("Test");
    expect(record?.fields?.Email).toBe(CANARY_EMAIL);
    expect(record?.fields?.["Product Name"]).toBe(GENERAL_RFQ_PRODUCT_LABEL);
    expect(record?.fields?.Requirements).toBe(CANARY_MESSAGE);
    expect(typeof record?.fields?.["Reference ID"]).toBe("string");
    expect(record?.fields?.Company ?? "").toBe("");

    const recordId = record?.id;
    if (recordId) {
      await request.delete(
        `${AIRTABLE_BASE_URL}/${baseId}/${encodeURIComponent(tableName)}/${recordId}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
    }
  });
});
