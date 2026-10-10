import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { captureExpectedConsoleErrors } from "@/test/console";
import { DEFAULT_RESEND_TIMEOUT_MS } from "@/lib/email/resend-http-client";
import { assertInquiryResponseContract } from "../../helpers/inquiry-contract";

/**
 * In-process lead-pipeline integration proof.
 *
 * Runs the REAL pipeline: real Zod schema, real `processValidatedInquiry`,
 * real in-memory rate limiter, and the real Turnstile verification logic.
 *
 * Node 项目执行真实 env/schema/管道，只替换出站 fetch。
 * 不把进程内证明当作真实 Worker 绑定或 provider 投递证明。
 */

const fetchMock = vi.fn<typeof fetch>();

import { POST } from "@/app/api/inquiry/route";
import { resetRateLimitStore } from "@/lib/security/distributed-rate-limit";

const inquiryRoute = {
  async POST(request: NextRequest) {
    const response = await POST(request);
    await assertInquiryResponseContract(response);
    return response;
  },
};

const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_ALWAYS_PASS_TEST_SECRET = "1x0000000000000000000000000000000AA";
const TURNSTILE_DUMMY_TEST_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const AIRTABLE_RECORDS_URL =
  "https://api.airtable.com/v0/test-base-id/test-table";

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
    .filter((call) => call.url === RESEND_EMAILS_URL);
}

function parseJsonBody(init: RequestInit | undefined): Record<string, unknown> {
  if (typeof init?.body !== "string") {
    throw new Error("Expected Resend request body to be a JSON string");
  }
  return JSON.parse(init.body) as Record<string, unknown>;
}

function getCapturedAirtableFields(): Record<string, unknown> {
  const call = fetchMock.mock.calls.find(
    ([input]) => resolveFetchUrl(input) === AIRTABLE_RECORDS_URL,
  );
  if (!call) {
    throw new Error("Airtable create was not called");
  }
  const body = parseJsonBody(call[1] as RequestInit | undefined) as {
    records?: Array<{ fields?: Record<string, unknown> }>;
  };
  const fields = body.records?.[0]?.fields;
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
  fullName: "Jane Buyer",
  email: "buyer@example.com",
  message: "Custom packaging details",
};

const CANONICAL_BUYER_MESSAGE =
  "SINK-PROOF-2026-07-18\nLine A: need <custom> height\nLine B: finish & timeline";

const CANONICAL_MESSAGE_INQUIRY_BODY = {
  turnstileToken: "valid-turnstile-token",
  fullName: "Jane Buyer",
  email: "buyer@example.com",
  message: CANONICAL_BUYER_MESSAGE,
};

describe("lead pipeline (in-process integration)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    resetRateLimitStore();
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("NEXT_PUBLIC_TEST_MODE", "false");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret-key");

    turnstileResponse = {
      success: true,
      hostname: "localhost",
      action: "product_inquiry",
    };

    fetchMock.mockImplementation(async (input: unknown) => {
      const url = resolveFetchUrl(input);
      if (url === TURNSTILE_SITEVERIFY_URL) {
        return jsonResponse(turnstileResponse);
      }
      if (url === RESEND_EMAILS_URL) {
        return jsonResponse({ id: "email_real_001" });
      }
      if (url === AIRTABLE_RECORDS_URL) {
        return jsonResponse({ records: [{ id: "rec_real_001" }] });
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });
  });

  afterEach(() => {
    // 业务可能捕获 fetch 内的异常；在调用方之外检查未知出站和请求方法。
    for (const [input, init] of fetchMock.mock.calls) {
      expect([
        TURNSTILE_SITEVERIFY_URL,
        RESEND_EMAILS_URL,
        AIRTABLE_RECORDS_URL,
        "https://fixture.upstash.io/multi-exec",
      ]).toContain(resolveFetchUrl(input));
      expect(new Request(input, init).method).toBe("POST");
    }
  });

  it("valid inquiry: persists the Airtable record and sends the Resend email", async () => {
    const response = await inquiryRoute.POST(
      makeInquiryRequest(VALID_INQUIRY_BODY),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.data.referenceId).toBe("string");
    expect(body.data.referenceId).toMatch(/^INQ-/);

    expect(
      fetchMock.mock.calls.filter(
        ([input]) => resolveFetchUrl(input) === AIRTABLE_RECORDS_URL,
      ),
    ).toHaveLength(1);
    const fields = getCapturedAirtableFields();
    expect(fields).toMatchObject({
      Email: "buyer@example.com",
      Source: "Website Inquiry",
      Status: "New",
      "First Name": "Jane",
      "Last Name": "Buyer",
      Requirements: "Custom packaging details",
    });
    expect(fields).not.toHaveProperty("Company");
    expect(fields).not.toHaveProperty("Quantity");
    expect(typeof fields["Reference ID"]).toBe("string");
    expect(fields["Reference ID"]).toBe(body.data.referenceId);
    expect(typeof fields["Message"]).toBe("string");
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
      expect(
        fetchMock.mock.calls.some(
          ([input]) => resolveFetchUrl(input) === AIRTABLE_RECORDS_URL,
        ),
      ).toBe(false);
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

    expect(
      fetchMock.mock.calls.filter(
        ([input]) => resolveFetchUrl(input) === AIRTABLE_RECORDS_URL,
      ),
    ).toHaveLength(1);
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

  it("delivers general inquiry with canonical message to both external sinks", async () => {
    const response = await inquiryRoute.POST(
      makeInquiryRequest({
        turnstileToken: "valid-turnstile-token",
        fullName: "Jane Buyer",
        email: "jane@example.com",
        message: "Need a custom component for a warehouse",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const fields = getCapturedAirtableFields();
    expect(fields["Email"]).toBe("jane@example.com");
    expect(fields["Requirements"]).toContain("Need a custom component");

    const resendBody = parseJsonBody(getResendCalls()[0]?.init);
    expect(resendBody.reply_to).toBe("jane@example.com");
    expect(resendBody.text as string).toContain("Need a custom component");
  });

  it("accepts optional empty message on general inquiry and still delivers", async () => {
    const response = await inquiryRoute.POST(
      makeInquiryRequest({
        turnstileToken: "valid-turnstile-token",
        fullName: "Jane Buyer",
        email: "jane@example.com",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(
      fetchMock.mock.calls.filter(
        ([input]) => resolveFetchUrl(input) === AIRTABLE_RECORDS_URL,
      ),
    ).toHaveLength(1);
    expect(getResendCalls()).toHaveLength(1);
  });

  it("airtable-only success: succeeds when email fails but Airtable persists", async () => {
    const consoleError = captureExpectedConsoleErrors(
      "Failed to send inquiry email",
      "Owner inquiry email failed",
    );
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = resolveFetchUrl(input);
      if (url === TURNSTILE_SITEVERIFY_URL) {
        return jsonResponse(turnstileResponse);
      }
      if (url === RESEND_EMAILS_URL) {
        return jsonResponse({ error: "resend down" }, 500);
      }
      if (url === AIRTABLE_RECORDS_URL) {
        return jsonResponse({ records: [{ id: "rec_real_001" }] });
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });

    const response = await inquiryRoute.POST(
      makeInquiryRequest({
        ...CANONICAL_MESSAGE_INQUIRY_BODY,
        email: "jane@example.com",
        message: "Need a custom component",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(getResendCalls()).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(
        ([input]) => resolveFetchUrl(input) === AIRTABLE_RECORDS_URL,
      ),
    ).toHaveLength(1);
    expect(getCapturedAirtableFields()["Requirements"]).toContain(
      "Need a custom component",
    );
    expect(getCapturedAirtableFields()["Message"]).toContain(
      "Need a custom component",
    );
    expect(consoleError).toHaveBeenCalled();
  });

  it("invalid payload: rejects with a validation code and touches no external sink", async () => {
    const response = await inquiryRoute.POST(
      makeInquiryRequest({ ...VALID_INQUIRY_BODY, email: "not-an-email" }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe(API_ERROR_CODES.INQUIRY_VALIDATION_FAILED);

    expect(
      fetchMock.mock.calls.some(
        ([input]) => resolveFetchUrl(input) === AIRTABLE_RECORDS_URL,
      ),
    ).toBe(false);
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

    expect(
      fetchMock.mock.calls.some(
        ([input]) => resolveFetchUrl(input) === AIRTABLE_RECORDS_URL,
      ),
    ).toBe(false);
    expect(getResendCalls()).toHaveLength(0);
  });

  it("airtable failure: still succeeds and delivers the owner email", async () => {
    const consoleError = captureExpectedConsoleErrors(
      "Failed to create lead record",
      "Inquiry Airtable backup failed",
    );
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = resolveFetchUrl(input);
      if (url === TURNSTILE_SITEVERIFY_URL)
        return jsonResponse(turnstileResponse);
      if (url === RESEND_EMAILS_URL)
        return jsonResponse({ id: "email_real_001" });
      if (url === AIRTABLE_RECORDS_URL) throw new Error("airtable down");
      throw new Error(`Unexpected fetch to ${url}`);
    });

    const response = await inquiryRoute.POST(
      makeInquiryRequest(VALID_INQUIRY_BODY),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.referenceId).toMatch(/^INQ-/);
    expect(getResendCalls()).toHaveLength(1);
    expect(consoleError).toHaveBeenCalled();
  });

  it("both channels fail: rejects with an inquiry processing error", async () => {
    const consoleError = captureExpectedConsoleErrors(
      "Failed to create lead record",
      "Failed to send inquiry email",
      "Owner inquiry email failed",
      "Inquiry Airtable backup failed",
    );
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = resolveFetchUrl(input);
      if (url === TURNSTILE_SITEVERIFY_URL) {
        return jsonResponse(turnstileResponse);
      }
      if (url === RESEND_EMAILS_URL) {
        return jsonResponse({ error: "resend down" }, 500);
      }
      if (url === AIRTABLE_RECORDS_URL) {
        throw new Error("airtable down");
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
    expect(response.headers.get("x-request-id")).toBeNull();
    expect(response.headers.get("x-observability-surface")).toBeNull();
    expect(consoleError).toHaveBeenCalled();
  });

  it("rejects when email fails and Airtable returns an invalid receipt", async () => {
    const consoleError = captureExpectedConsoleErrors(
      "Failed to create lead record",
      "Failed to send inquiry email",
      "Owner inquiry email failed",
      "Inquiry Airtable backup failed",
    );
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = resolveFetchUrl(input);
      if (url === TURNSTILE_SITEVERIFY_URL) {
        return jsonResponse(turnstileResponse);
      }
      if (url === RESEND_EMAILS_URL) {
        return jsonResponse({ error: "resend down" }, 500);
      }
      if (url === AIRTABLE_RECORDS_URL) {
        return jsonResponse({ records: [{}] });
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
    expect(consoleError).toHaveBeenCalled();
  });

  it("limits the eleventh real request before any additional outbound call", async () => {
    for (let index = 0; index < 10; index += 1) {
      expect(
        (await inquiryRoute.POST(makeInquiryRequest(VALID_INQUIRY_BODY)))
          .status,
      ).toBe(200);
    }
    const count = fetchMock.mock.calls.length;
    const response = await inquiryRoute.POST(
      makeInquiryRequest(VALID_INQUIRY_BODY),
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      success: false,
      errorCode: "RATE_LIMIT_EXCEEDED",
    });
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(fetchMock).toHaveBeenCalledTimes(count);
  });

  it.each([true, false])(
    "Upstash failure stays fail-open but Turnstile verified=%s",
    async (verified) => {
      const errors = captureExpectedConsoleErrors(
        "[Rate Limit] Storage backend error details",
      );
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fixture.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fixture-token");
      turnstileResponse.success = verified;
      const normal = fetchMock.getMockImplementation()!;
      fetchMock.mockImplementation((input, init) => {
        if (
          resolveFetchUrl(input) === "https://fixture.upstash.io/multi-exec"
        ) {
          return Promise.reject(new Error("fixture storage unavailable"));
        }
        return normal(input, init);
      });
      const response = await inquiryRoute.POST(
        makeInquiryRequest(VALID_INQUIRY_BODY),
      );
      expect(response.status).toBe(verified ? 200 : 400);
      expect(getResendCalls()).toHaveLength(verified ? 1 : 0);
      expect(
        fetchMock.mock.calls.filter(
          ([input]) => resolveFetchUrl(input) === AIRTABLE_RECORDS_URL,
        ),
      ).toHaveLength(verified ? 1 : 0);
      expect(errors).toHaveBeenCalled();
    },
  );

  it("maps a real Upstash over-limit response to 429 without delivery", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fixture.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fixture-token");
    fetchMock.mockResolvedValue(
      jsonResponse([{ result: 11 }, { result: 0 }, { result: 30_000 }]),
    );
    const response = await inquiryRoute.POST(
      makeInquiryRequest(VALID_INQUIRY_BODY),
    );
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(
      fetchMock.mock.calls.map(([input]) => resolveFetchUrl(input)),
    ).toEqual(["https://fixture.upstash.io/multi-exec"]);
    const commands = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body));
    expect(commands).toEqual([
      ["INCR", expect.stringMatching(/^ratelimit:inquiry:/)],
      ["PEXPIRE", commands[0][1], "60000", "NX"],
      ["PTTL", commands[0][1]],
    ]);
  });

  it.each([true, false])(
    "Resend timeout with Airtable success=%s uses the real delivery policy",
    async (recordOk) => {
      const errors = captureExpectedConsoleErrors(
        "Failed to send inquiry email",
        "Owner inquiry email failed",
        "Failed to create lead record",
        "Inquiry Airtable backup failed",
      );
      vi.useFakeTimers();
      let signal: AbortSignal | null | undefined;
      let started!: () => void;
      const mailStarted = new Promise<void>((resolve) => {
        started = resolve;
      });
      fetchMock.mockImplementation(async (input, init) => {
        const url = resolveFetchUrl(input);
        if (url === TURNSTILE_SITEVERIFY_URL)
          return jsonResponse(turnstileResponse);
        if (url === AIRTABLE_RECORDS_URL)
          return recordOk
            ? jsonResponse({ records: [{ id: "rec-timeout-backup" }] })
            : jsonResponse({}, 503);
        if (url !== RESEND_EMAILS_URL)
          throw new Error("Unexpected timeout fixture URL");
        signal = init?.signal;
        started();
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        });
      });
      let settled = false;
      const pending = inquiryRoute
        .POST(makeInquiryRequest(VALID_INQUIRY_BODY))
        .then((response) => {
          settled = true;
          return response;
        });
      await mailStarted;
      await vi.advanceTimersByTimeAsync(DEFAULT_RESEND_TIMEOUT_MS - 1);
      expect(getCapturedAirtableFields()["Requirements"]).toBe(
        VALID_INQUIRY_BODY.message,
      );
      expect(settled).toBe(false);
      expect(signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(signal?.aborted).toBe(true);
      expect((await pending).status).toBe(recordOk ? 200 : 500);
      expect(errors).toHaveBeenCalled();
    },
  );

  it("reads changed credentials at request time without reimporting the pipeline", async () => {
    expect(
      (await inquiryRoute.POST(makeInquiryRequest(VALID_INQUIRY_BODY))).status,
    ).toBe(200);
    vi.stubEnv("RESEND_API_KEY", "second-request-key");
    vi.stubEnv("AIRTABLE_API_KEY", "second-record-key");
    expect(
      (await inquiryRoute.POST(makeInquiryRequest(VALID_INQUIRY_BODY))).status,
    ).toBe(200);
    const mails = getResendCalls();
    expect(new Headers(mails[0]!.init?.headers).get("authorization")).toBe(
      "Bearer test-resend-key",
    );
    expect(new Headers(mails[1]!.init?.headers).get("authorization")).toBe(
      "Bearer second-request-key",
    );
    const records = fetchMock.mock.calls.filter(
      ([input]) => resolveFetchUrl(input) === AIRTABLE_RECORDS_URL,
    );
    expect(new Headers(records[1]![1]?.headers).get("authorization")).toBe(
      "Bearer second-record-key",
    );
  });

  it("preserves attribution values and keeps untrusted fields out of both sinks", async () => {
    const response = await inquiryRoute.POST(
      makeInquiryRequest({
        ...VALID_INQUIRY_BODY,
        type: "spoof",
        phone: "private-not-a-field",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "campaign",
        utmTerm: "custom parts",
        utmContent: "hero",
        landingPage: "/contact",
        capturedAt: "2026-10-09T00:00:00.000Z",
      }),
    );
    expect(response.status).toBe(200);
    expect(getCapturedAirtableFields()).toMatchObject({
      "UTM Source": "google",
      "UTM Medium": "cpc",
      "UTM Campaign": "campaign",
      "UTM Term": "custom parts",
      "UTM Content": "hero",
      "Landing Page": "/contact",
      "Captured At": "2026-10-09T00:00:00.000Z",
    });
    const mail = parseJsonBody(getResendCalls()[0]?.init);
    expect(mail.tags).toContainEqual({ name: "type", value: "inquiry" });
    for (const body of [getCapturedAirtableFields(), mail]) {
      expect(JSON.stringify(body)).not.toContain("valid-turnstile-token");
      expect(JSON.stringify(body)).not.toContain("private-not-a-field");
    }
  });

  it.each([
    [
      "origin",
      {
        "Content-Type": "application/json",
        Origin: "https://attacker.example",
      },
      403,
    ],
    ["media type", { "Content-Type": "application/jsonx" }, 415],
  ] as const)(
    "rejects invalid %s before touching configured Redis or any provider",
    async (_name, headers, status) => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fixture.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fixture-token");
      const response = await inquiryRoute.POST(
        new NextRequest("http://localhost/api/inquiry", {
          method: "POST",
          headers,
          body: JSON.stringify(VALID_INQUIRY_BODY),
        }),
      );
      expect(response.status).toBe(status);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("rejects oversized UTF-8 body without a declared length or any delivery", async () => {
    const request = makeInquiryRequest({
      ...VALID_INQUIRY_BODY,
      message: "中".repeat(24_000),
    });
    expect(request.headers.has("content-length")).toBe(false);
    const response = await inquiryRoute.POST(request);
    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("neutralizes formula text at Airtable while rejecting formula-prefix email", async () => {
    const message = "=1+1\nBuyer requirements";
    const accepted = await inquiryRoute.POST(
      makeInquiryRequest({ ...VALID_INQUIRY_BODY, message }),
    );
    expect(accepted.status).toBe(200);
    expect(getCapturedAirtableFields()["Requirements"]).toBe(`'${message}`);
    const count = fetchMock.mock.calls.length;
    const rejected = await inquiryRoute.POST(
      makeInquiryRequest({
        ...VALID_INQUIRY_BODY,
        email: "+buyer@example.com",
      }),
    );
    expect(rejected.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(count);
  });
});
