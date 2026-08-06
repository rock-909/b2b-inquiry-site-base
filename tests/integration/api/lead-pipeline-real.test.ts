import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { captureExpectedConsoleErrors } from "@/test/console";

/**
 * Real end-to-end lead-pipeline proof.
 *
 * Runs the REAL pipeline: real Zod schema, real `processValidatedInquiry`,
 * real in-memory rate limiter, and the real Turnstile verification logic.
 *
 * Only the external wires are stubbed:
 * - `global.fetch` — Turnstile siteverify and the Resend HTTP API
 * - the `airtable` SDK — CRM wire with captured create payloads
 */

const { fetchMock } = vi.hoisted(() => {
  const fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return { fetchMock };
});

const { airtableCreateMock } = vi.hoisted(() => ({
  airtableCreateMock: vi.fn(),
}));

vi.mock("airtable", () => {
  const create = airtableCreateMock;
  const table = vi.fn(() => ({ create }));
  const base = vi.fn(() => ({ table }));
  const configure = vi.fn();
  return { default: { configure, base } };
});

import * as inquiryRoute from "@/app/api/inquiry/route";
import { resetRateLimitStore } from "@/lib/security/distributed-rate-limit";

const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_ALWAYS_PASS_TEST_SECRET = "1x0000000000000000000000000000000AA";
const TURNSTILE_DUMMY_TEST_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
const RESEND_EMAILS_URL = "https://api.resend.com/emails";

interface TurnstileSiteverifyResponse {
  success: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
}

let turnstileResponse: TurnstileSiteverifyResponse = {
  success: true,
  hostname: "localhost",
  action: "product_inquiry",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function resolveFetchUrl(input: unknown): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (input && typeof input === "object" && "url" in input) {
    return String((input as { url: unknown }).url);
  }
  return String(input);
}

function getResendCalls(): Array<{
  url: string;
  init: RequestInit | undefined;
}> {
  return fetchMock.mock.calls
    .map(([input, init]) => ({
      url: resolveFetchUrl(input),
      init: init as RequestInit | undefined,
    }))
    .filter((call) => call.url.includes("api.resend.com"));
}

function parseJsonBody(init: RequestInit | undefined): Record<string, unknown> {
  if (typeof init?.body !== "string") {
    throw new Error("Expected Resend request body to be a JSON string");
  }
  return JSON.parse(init.body) as Record<string, unknown>;
}

function getCapturedAirtableFields(): Record<string, unknown> {
  const call = airtableCreateMock.mock.calls[0];
  if (!call) {
    throw new Error("Airtable create was not called");
  }
  const records = call[0] as Array<{ fields: Record<string, unknown> }>;
  const fields = records[0]?.fields;
  if (!fields) {
    throw new Error("Airtable create payload had no fields");
  }
  return fields;
}

function makeInquiryRequest(body: unknown): NextRequest {
  return new NextRequest(
    new Request("http://localhost/api/inquiry", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const VALID_INQUIRY_BODY = {
  turnstileToken: "valid-turnstile-token",
  productInquiryKind: "catalog-product",
  fullName: "Jane Buyer",
  email: "buyer@example.com",
  catalogProductId: "abs-flood-barriers",
  message: "Custom packaging details",
};

const CANONICAL_BUYER_MESSAGE =
  "SINK-PROOF-2026-07-18\nLine A: need <custom> height\nLine B: finish & timeline";

const CANONICAL_MESSAGE_INQUIRY_BODY = {
  turnstileToken: "valid-turnstile-token",
  productInquiryKind: "general-rfq",
  fullName: "Jane Buyer",
  email: "buyer@example.com",
  message: CANONICAL_BUYER_MESSAGE,
};

const CATALOG_PRODUCT_LABEL = "ABS Interlocking Boxwall";

describe("lead pipeline (real end-to-end proof)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitStore();
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("NEXT_PUBLIC_TEST_MODE", "false");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret-key");

    turnstileResponse = {
      success: true,
      hostname: "localhost",
      action: "product_inquiry",
    };

    airtableCreateMock.mockImplementation(
      async (records: Array<{ fields: Record<string, unknown> }>) => [
        {
          id: "rec_real_001",
          fields: records[0]?.fields ?? {},
          get: () => new Date().toISOString(),
        },
      ],
    );

    fetchMock.mockImplementation(async (input: unknown) => {
      const url = resolveFetchUrl(input);
      if (url === TURNSTILE_SITEVERIFY_URL) {
        return jsonResponse(turnstileResponse);
      }
      if (url === RESEND_EMAILS_URL) {
        return jsonResponse({ id: "email_real_001" });
      }
      if (url.includes("/messages/")) {
        return jsonResponse({});
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });
  });

  it("valid inquiry: persists the Airtable record and sends the Resend email", async () => {
    const response = await inquiryRoute.POST(
      makeInquiryRequest(VALID_INQUIRY_BODY),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.data.referenceId).toBe("string");
    expect(body.data.referenceId).toMatch(/^PRO-/);

    expect(airtableCreateMock).toHaveBeenCalledTimes(1);
    const fields = getCapturedAirtableFields();
    expect(fields).toMatchObject({
      Email: "buyer@example.com",
      Source: "Product Inquiry",
      Status: "New",
      "First Name": "Jane",
      "Last Name": "Buyer",
      "Product Name": CATALOG_PRODUCT_LABEL,
      "Product Slug": "abs-flood-barriers",
      Requirements: "Custom packaging details",
    });
    expect(fields).not.toHaveProperty("Company");
    expect(fields).not.toHaveProperty("Quantity");
    expect(typeof fields["Reference ID"]).toBe("string");
    expect(fields["Reference ID"]).toBe(body.data.referenceId);
    expect(typeof fields["Message"]).toBe("string");
    expect(fields["Message"]).toContain(CATALOG_PRODUCT_LABEL);
    // 邮件发出去了就不能挂失败提示，否则业主每条线索都在报警
    expect(fields["Message"]).not.toContain("⚠️");

    const resendCalls = getResendCalls();
    expect(resendCalls).toHaveLength(1);
    const resendBody = parseJsonBody(resendCalls[0]?.init);
    expect(resendBody.to).toEqual(["reply@example.com"]);
    expect(resendBody.reply_to).toBe("buyer@example.com");
    expect(typeof resendBody.subject).toBe("string");
    expect((resendBody.subject as string).length).toBeGreaterThan(0);
    expect(typeof resendBody.html).toBe("string");
    expect(typeof resendBody.text).toBe("string");

    // The reference the buyer is shown must be quotable back to the owner:
    // same value in Airtable, the owner email, and the provider metadata.
    const referenceId = body.data.referenceId as string;
    expect(resendBody.subject).toContain(referenceId);
    expect(resendBody.html).toContain(referenceId);
    expect(resendBody.text).toContain(referenceId);
    expect(resendBody.tags).toContainEqual({
      name: "reference-id",
      value: referenceId,
    });
  });

  it("accepts the exact official preview test contract through Siteverify", async () => {
    vi.stubEnv("APP_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_TEST_MODE", "true");
    vi.stubEnv("TURNSTILE_SECRET_KEY", TURNSTILE_ALWAYS_PASS_TEST_SECRET);
    turnstileResponse = {
      success: true,
      hostname: "dummy.test",
      action: "dummy_test_action",
    };

    const response = await inquiryRoute.POST(
      makeInquiryRequest({
        ...VALID_INQUIRY_BODY,
        turnstileToken: TURNSTILE_DUMMY_TEST_TOKEN,
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true });
    const siteverifyCall = fetchMock.mock.calls.find(
      ([input]) => resolveFetchUrl(input) === TURNSTILE_SITEVERIFY_URL,
    );
    expect(siteverifyCall).toBeDefined();
    const siteverifyBody = siteverifyCall?.[1]?.body;
    expect(siteverifyBody).toBeInstanceOf(URLSearchParams);
    expect((siteverifyBody as URLSearchParams).get("secret")).toBe(
      TURNSTILE_ALWAYS_PASS_TEST_SECRET,
    );
    expect((siteverifyBody as URLSearchParams).get("response")).toBe(
      TURNSTILE_DUMMY_TEST_TOKEN,
    );
  });

  it.each([
    [
      "production env",
      "production",
      "true",
      TURNSTILE_ALWAYS_PASS_TEST_SECRET,
      TURNSTILE_DUMMY_TEST_TOKEN,
    ],
    [
      "unknown env",
      "staging",
      "true",
      TURNSTILE_ALWAYS_PASS_TEST_SECRET,
      TURNSTILE_DUMMY_TEST_TOKEN,
    ],
    [
      "disabled test mode",
      "preview",
      "false",
      TURNSTILE_ALWAYS_PASS_TEST_SECRET,
      TURNSTILE_DUMMY_TEST_TOKEN,
    ],
    [
      "non-test secret",
      "preview",
      "true",
      "real-secret-key",
      TURNSTILE_DUMMY_TEST_TOKEN,
    ],
    [
      "non-dummy token",
      "preview",
      "true",
      TURNSTILE_ALWAYS_PASS_TEST_SECRET,
      "real-widget-token",
    ],
  ])(
    "does not trust dummy Siteverify metadata with %s",
    async (_case, appEnv, testMode, secretKey, token) => {
      vi.stubEnv("APP_ENV", appEnv);
      vi.stubEnv("NEXT_PUBLIC_TEST_MODE", testMode);
      vi.stubEnv("TURNSTILE_SECRET_KEY", secretKey);
      turnstileResponse = {
        success: true,
        hostname: "dummy.test",
        action: "dummy_test_action",
      };

      const response = await inquiryRoute.POST(
        makeInquiryRequest({
          ...VALID_INQUIRY_BODY,
          turnstileToken: token,
        }),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        success: false,
        errorCode: API_ERROR_CODES.TURNSTILE_REJECTED,
      });
      expect(airtableCreateMock).not.toHaveBeenCalled();
      expect(getResendCalls()).toHaveLength(0);
    },
  );

  it("forwards canonical message through Airtable Requirements and owner email sinks", async () => {
    const response = await inquiryRoute.POST(
      makeInquiryRequest(CANONICAL_MESSAGE_INQUIRY_BODY),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    expect(airtableCreateMock).toHaveBeenCalledTimes(1);
    const fields = getCapturedAirtableFields();
    expect(fields["Requirements"]).toBe(CANONICAL_BUYER_MESSAGE);
    expect(fields["Email"]).toBe("buyer@example.com");

    const resendCalls = getResendCalls();
    expect(resendCalls).toHaveLength(1);
    const resendBody = parseJsonBody(resendCalls[0]?.init);
    const html = resendBody.html as string;
    const text = resendBody.text as string;

    expect(html).toContain("SINK-PROOF-2026-07-18");
    expect(html).toContain("&lt;custom&gt;");
    expect(html).toContain("finish &amp; timeline");
    expect(html).not.toContain("need <custom> height");

    expect(text).toContain(`Requirements: ${CANONICAL_BUYER_MESSAGE}`);
    expect(text).toContain("buyer@example.com");
  });

  it("delivers general-rfq inquiry with canonical message to both external sinks", async () => {
    const response = await inquiryRoute.POST(
      makeInquiryRequest({
        turnstileToken: "valid-turnstile-token",
        productInquiryKind: "general-rfq",
        fullName: "Jane Buyer",
        email: "jane@example.com",
        message: "Need flood protection for warehouse",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const fields = getCapturedAirtableFields();
    expect(fields["Email"]).toBe("jane@example.com");
    expect(fields["Requirements"]).toContain("Need flood protection");

    const resendBody = parseJsonBody(getResendCalls()[0]?.init);
    expect(resendBody.reply_to).toBe("jane@example.com");
    expect(resendBody.text as string).toContain("Need flood protection");
  });

  it("accepts optional empty message on general-rfq and still delivers", async () => {
    const response = await inquiryRoute.POST(
      makeInquiryRequest({
        turnstileToken: "valid-turnstile-token",
        productInquiryKind: "general-rfq",
        fullName: "Jane Buyer",
        email: "jane@example.com",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(airtableCreateMock).toHaveBeenCalledTimes(1);
    expect(getResendCalls()).toHaveLength(1);
  });

  it("airtable-only success: succeeds when email fails but Airtable persists", async () => {
    const consoleError = captureExpectedConsoleErrors(
      "Failed to send product inquiry email",
      "Product owner email failed",
    );
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = resolveFetchUrl(input);
      if (url === TURNSTILE_SITEVERIFY_URL) {
        return jsonResponse(turnstileResponse);
      }
      if (url === RESEND_EMAILS_URL) {
        return jsonResponse({ error: "resend down" }, 500);
      }
      if (url.includes("/messages/")) {
        return jsonResponse({});
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });

    const response = await inquiryRoute.POST(
      makeInquiryRequest({
        ...CANONICAL_MESSAGE_INQUIRY_BODY,
        email: "jane@example.com",
        message: "Need flood protection",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(getResendCalls()).toHaveLength(1);
    expect(airtableCreateMock).toHaveBeenCalledTimes(1);
    expect(getCapturedAirtableFields()["Requirements"]).toContain(
      "Need flood protection",
    );
    expect(consoleError).toHaveBeenCalledTimes(2);
  });

  it("bakes the email-failure notice into the Airtable Message the owner reads", async () => {
    const consoleError = captureExpectedConsoleErrors(
      "Failed to send product inquiry email",
      "Product owner email failed",
    );
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = resolveFetchUrl(input);
      if (url === TURNSTILE_SITEVERIFY_URL) {
        return jsonResponse(turnstileResponse);
      }
      if (url === RESEND_EMAILS_URL) {
        return jsonResponse({ error: "resend down" }, 500);
      }
      if (url.includes("/messages/")) {
        return jsonResponse({});
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });

    const response = await inquiryRoute.POST(
      makeInquiryRequest(CANONICAL_MESSAGE_INQUIRY_BODY),
    );

    expect(response.status).toBe(200);
    // 通知邮件没发出去时，业主唯一能看到这条线索的地方就是这一格。
    // 单元测试只证到 process-lead 传给自己 mock 的参数；这里证的是
    // 真正写进 Airtable 的那个字段名和那段文本。
    const message = getCapturedAirtableFields()["Message"];
    expect(typeof message).toBe("string");
    expect(message as string).toMatch(/^⚠️ NOTE:/u);
    expect(message as string).toContain("FAILED to send");
    // 提示只是前缀，买家原文必须一字不少地跟在后面
    expect(message as string).toContain(CANONICAL_BUYER_MESSAGE);
    expect(consoleError).toHaveBeenCalledTimes(2);
  });

  it("ignores legacy company, quantity, and requirements payload fields", async () => {
    const response = await inquiryRoute.POST(
      makeInquiryRequest({
        ...VALID_INQUIRY_BODY,
        company: "Legacy Co",
        quantity: 100,
        requirements: "Legacy RFQ note",
        message: "Canonical buyer text",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const fields = getCapturedAirtableFields();
    expect(fields["Requirements"]).toBe("Canonical buyer text");
    expect(fields).not.toHaveProperty("Company");
    expect(fields).not.toHaveProperty("Quantity");
  });

  it("invalid payload: rejects with a validation code and touches no external sink", async () => {
    const response = await inquiryRoute.POST(
      makeInquiryRequest({ ...VALID_INQUIRY_BODY, email: "not-an-email" }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe(API_ERROR_CODES.INQUIRY_VALIDATION_FAILED);

    expect(airtableCreateMock).not.toHaveBeenCalled();
    expect(getResendCalls()).toHaveLength(0);
  });

  it("failed Turnstile: rejects the inquiry and touches no external sink", async () => {
    turnstileResponse = {
      success: false,
      "error-codes": ["invalid-input-response"],
    };

    const response = await inquiryRoute.POST(
      makeInquiryRequest(VALID_INQUIRY_BODY),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe(API_ERROR_CODES.TURNSTILE_REJECTED);

    expect(airtableCreateMock).not.toHaveBeenCalled();
    expect(getResendCalls()).toHaveLength(0);
  });

  it("airtable failure: still succeeds and delivers the owner email", async () => {
    const consoleError = captureExpectedConsoleErrors(
      "Failed to create lead record",
      "Product Airtable createLead failed",
    );
    airtableCreateMock.mockRejectedValue(new Error("airtable down"));

    const response = await inquiryRoute.POST(
      makeInquiryRequest(VALID_INQUIRY_BODY),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.referenceId).toMatch(/^PRO-/);
    expect(getResendCalls()).toHaveLength(1);
    expect(consoleError).toHaveBeenCalledTimes(2);
  });

  it("both channels fail: rejects with an inquiry processing error", async () => {
    const consoleError = captureExpectedConsoleErrors(
      "Failed to create lead record",
      "Failed to send product inquiry email",
      "Product owner email failed",
      "Product Airtable createLead failed",
    );
    airtableCreateMock.mockRejectedValue(new Error("airtable down"));
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = resolveFetchUrl(input);
      if (url === TURNSTILE_SITEVERIFY_URL) {
        return jsonResponse(turnstileResponse);
      }
      if (url === RESEND_EMAILS_URL) {
        return jsonResponse({ error: "resend down" }, 500);
      }
      if (url.includes("/messages/")) {
        return jsonResponse({});
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });

    const response = await inquiryRoute.POST(
      makeInquiryRequest(VALID_INQUIRY_BODY),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe(API_ERROR_CODES.INQUIRY_PROCESSING_ERROR);
    expect(getResendCalls()).toHaveLength(1);
    expect(consoleError).toHaveBeenCalledTimes(4);
  });

  it("rejects when email fails and Airtable returns an invalid receipt", async () => {
    const consoleError = captureExpectedConsoleErrors(
      "Failed to create lead record",
      "Failed to send product inquiry email",
      "Product owner email failed",
      "Product Airtable createLead failed",
    );
    airtableCreateMock.mockResolvedValue([{ id: undefined }]);
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = resolveFetchUrl(input);
      if (url === TURNSTILE_SITEVERIFY_URL) {
        return jsonResponse(turnstileResponse);
      }
      if (url === RESEND_EMAILS_URL) {
        return jsonResponse({ error: "resend down" }, 500);
      }
      if (url.includes("/messages/")) {
        return jsonResponse({});
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });

    const response = await inquiryRoute.POST(
      makeInquiryRequest(VALID_INQUIRY_BODY),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe(API_ERROR_CODES.INQUIRY_PROCESSING_ERROR);
    expect(getResendCalls()).toHaveLength(1);
    expect(consoleError).toHaveBeenCalledTimes(4);
  });
});
