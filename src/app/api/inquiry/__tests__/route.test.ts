import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import * as safeParseJsonModule from "@/lib/api/safe-parse-json";
import { processValidatedInquiry } from "@/lib/lead-pipeline/process-lead";
import * as leadSchemaModule from "@/lib/lead-pipeline/lead-schema";
import { checkDistributedRateLimit } from "@/lib/security/distributed-rate-limit";
import { verifyTurnstileDetailed } from "@/lib/security/turnstile";
import { OPTIONS, POST } from "../route";

// Mock dependencies before imports
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  sanitizeIP: (ip: string | undefined | null) =>
    ip ? "[REDACTED_IP]" : "[NO_IP]",
  sanitizeEmail: (email: string | undefined | null) =>
    email ? "[REDACTED_EMAIL]" : "[NO_EMAIL]",
}));

vi.mock("@/lib/security/distributed-rate-limit", () => ({
  checkDistributedRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 5,
    resetTime: Date.now() + 60000,
    retryAfter: null,
  })),
  createRateLimitHeaders: vi.fn(() => new Headers()),
}));

vi.mock("@/lib/lead-pipeline/process-lead", () => ({
  processValidatedInquiry: vi.fn(() =>
    Promise.resolve({
      success: true,
      emailSent: true,
      ownerNotified: true,
      recordCreated: true,
      referenceId: "ref-123",
    }),
  ),
}));

vi.mock("@/lib/security/turnstile", () => ({
  verifyTurnstileDetailed: vi.fn(() => Promise.resolve({ success: true })),
}));

// Mock CORS utilities
vi.mock("@/lib/api/cors-utils", () => ({
  applyCorsHeaders: vi.fn(
    ({ response, request }: { response: any; request: NextRequest }) => {
      const origin = request.headers.get("origin");
      if (origin) {
        response.headers.set("Access-Control-Allow-Origin", origin);
      }
      return response;
    },
  ),
  createCorsPreflightResponse: vi.fn((request: NextRequest) => {
    const origin = request.headers.get("origin");
    const headers: Record<string, string> = {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (origin) {
      headers["Access-Control-Allow-Origin"] = origin;
    }
    return new (require("next/server").NextResponse)(null, {
      status: 200,
      headers,
    });
  }),
}));

describe("/api/inquiry route", () => {
  function createInquiryRequest(
    body: BodyInit | null,
    headers: Record<string, string> = {},
  ): NextRequest {
    return new NextRequest("http://localhost:3000/api/inquiry", {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("POST", () => {
    // Default happy-path payload: a real catalog product, identified by a
    // registry-validated slug (never a client-invented product name).
    const validInquiryData = {
      turnstileToken: "valid-token",
      type: "product",
      productInquiryKind: "catalog-product",
      fullName: "John Doe",
      email: "john@example.com",
      catalogProductId: "abs-flood-barriers",
      message: "I am interested in your products.",
    };

    const generalRfqData = {
      turnstileToken: "valid-token",
      type: "product",
      productInquiryKind: "general-rfq",
      fullName: "Rita Buyer",
      email: "rita@example.com",
      message: "Submitted via the request-quote form.",
    };

    it("accepts a catalog product inquiry and forwards the validated identity", async () => {
      const safeParseSpy = vi.spyOn(safeParseJsonModule, "safeParseJson");
      const schemaSpy = vi.spyOn(
        leadSchemaModule.productLeadSchema,
        "safeParse",
      );
      const request = createInquiryRequest(JSON.stringify(validInquiryData));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.referenceId).toBe("ref-123");
      expect(processValidatedInquiry).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "product",
          email: "john@example.com",
          productInquiryKind: "catalog-product",
          catalogProductId: "abs-flood-barriers",
        }),
      );
      expect(safeParseSpy).toHaveBeenCalledTimes(1);
      expect(schemaSpy).toHaveBeenCalledTimes(1);
      expect(processValidatedInquiry).toHaveBeenCalledTimes(1);
      expect(response.headers.get("x-request-id")).toBeNull();
      expect(response.headers.get("x-observability-surface")).toBeNull();
    });

    it("accepts a general RFQ with no per-product identity", async () => {
      const request = createInquiryRequest(JSON.stringify(generalRfqData));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      const callArgs = vi.mocked(processValidatedInquiry).mock
        .calls[0]![0] as Record<string, unknown>;
      expect(callArgs.productInquiryKind).toBe("general-rfq");
      expect(callArgs.catalogProductId).toBeUndefined();
    });

    it("accepts a buyer-interest-only general RFQ and keeps interest as description, not identity", async () => {
      const request = createInquiryRequest(
        JSON.stringify({
          ...generalRfqData,
          buyerInterest: "Aluminum flood gates for a garage",
        }),
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      const callArgs = vi.mocked(processValidatedInquiry).mock
        .calls[0]![0] as Record<string, unknown>;
      expect(callArgs.productInquiryKind).toBe("general-rfq");
      expect(callArgs.buyerInterest).toBe("Aluminum flood gates for a garage");
      expect(callArgs.catalogProductId).toBeUndefined();
    });

    it("rejects an unknown catalog product id before lead processing", async () => {
      const request = createInquiryRequest(
        JSON.stringify({
          ...validInquiryData,
          catalogProductId: "not-a-real-product",
        }),
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        success: false,
        errorCode: API_ERROR_CODES.INQUIRY_VALIDATION_FAILED,
        details: ["errors.generic"],
      });
      expect(processValidatedInquiry).not.toHaveBeenCalled();
    });

    it("rejects a general RFQ that smuggles a catalog product identity", async () => {
      const request = createInquiryRequest(
        JSON.stringify({
          ...generalRfqData,
          catalogProductId: "abs-flood-barriers",
        }),
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        success: false,
        errorCode: API_ERROR_CODES.INQUIRY_VALIDATION_FAILED,
        details: ["errors.generic"],
      });
      expect(processValidatedInquiry).not.toHaveBeenCalled();
    });

    it("passes attribution fields to processValidatedInquiry", async () => {
      const request = createInquiryRequest(
        JSON.stringify({
          ...validInquiryData,
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "flood-barriers",
          gclid: "gclid-rfq-123",
          landingPage: "/en/request-quote",
          capturedAt: "2026-07-04T00:00:00.000Z",
        }),
      );

      await POST(request);

      expect(processValidatedInquiry).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "product",
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "flood-barriers",
          gclid: "gclid-rfq-123",
          landingPage: "/en/request-quote",
          capturedAt: "2026-07-04T00:00:00.000Z",
        }),
      );
    });

    it("binds Turnstile verification to the product_inquiry action", async () => {
      const request = createInquiryRequest(JSON.stringify(validInquiryData));

      await POST(request);

      expect(verifyTurnstileDetailed).toHaveBeenCalledWith(
        "valid-token",
        expect.any(String),
      );
    });

    it("should apply CORS headers on POST response when Origin is present", async () => {
      const origin = "http://localhost:3000";
      const request = createInquiryRequest(JSON.stringify(validInquiryData), {
        origin,
      });

      const response = await POST(request);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    });

    it("should return 429 when rate limited", async () => {
      const rateLimit = await import("@/lib/security/distributed-rate-limit");
      vi.mocked(rateLimit.checkDistributedRateLimit).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        retryAfter: 60,
      });

      const request = createInquiryRequest(JSON.stringify(validInquiryData));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe(API_ERROR_CODES.RATE_LIMIT_EXCEEDED);
      // 限流是第一道闸：被挡住的请求不该消耗一次 Turnstile token，也不该产生投递。
      expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
      expect(processValidatedInquiry).not.toHaveBeenCalled();
    });

    it("should return 400 for invalid JSON", async () => {
      const request = createInquiryRequest("invalid json");

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe(API_ERROR_CODES.INVALID_JSON_BODY);
      expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
      expect(processValidatedInquiry).not.toHaveBeenCalled();
    });

    it("should process valid inquiry without a replay key", async () => {
      const request = new NextRequest("http://localhost:3000/api/inquiry", {
        method: "POST",
        body: JSON.stringify(validInquiryData),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(processValidatedInquiry).toHaveBeenCalledTimes(1);
    });

    it("should return 413 when payload exceeds the shared JSON body limit", async () => {
      const request = createInquiryRequest(JSON.stringify(validInquiryData), {
        "Content-Length": "70000",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(413);
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe(API_ERROR_CODES.PAYLOAD_TOO_LARGE);
    });

    it("should process repeated valid inquiry requests independently", async () => {
      const firstRequest = createInquiryRequest(
        JSON.stringify(validInquiryData),
      );
      const secondRequest = createInquiryRequest(
        JSON.stringify(validInquiryData),
      );

      const firstResponse = await POST(firstRequest);
      const secondResponse = await POST(secondRequest);
      const firstData = await firstResponse.json();
      const secondData = await secondResponse.json();

      expect(firstResponse.status).toBe(200);
      expect(secondResponse.status).toBe(200);
      expect(firstData.success).toBe(true);
      expect(secondData.success).toBe(true);
      expect(processValidatedInquiry).toHaveBeenCalledTimes(2);
    });

    it("should return 400 when turnstile token is missing", async () => {
      const dataWithoutToken = { ...validInquiryData };
      delete (dataWithoutToken as { turnstileToken?: string }).turnstileToken;

      const request = createInquiryRequest(JSON.stringify(dataWithoutToken));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe(API_ERROR_CODES.TURNSTILE_REQUIRED);
    });

    it("treats a whitespace-only turnstile token as missing without verification or lead processing", async () => {
      const request = createInquiryRequest(
        JSON.stringify({ ...validInquiryData, turnstileToken: "   " }),
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        success: false,
        errorCode: API_ERROR_CODES.TURNSTILE_REQUIRED,
      });
      expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
      expect(processValidatedInquiry).not.toHaveBeenCalled();
    });

    it("should reject invalid email before turnstile and lead processing", async () => {
      const request = createInquiryRequest(
        JSON.stringify({ ...validInquiryData, email: "not-an-email" }),
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        success: false,
        errorCode: API_ERROR_CODES.INQUIRY_VALIDATION_FAILED,
        details: ["errors.email.invalid"],
      });
      expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
      expect(processValidatedInquiry).not.toHaveBeenCalled();
    });

    it("should report missing required identity fields before turnstile and lead processing", async () => {
      function omitInquiryField(field: "fullName" | "email") {
        const body: Record<string, unknown> = { ...validInquiryData };
        delete body[field];
        return body;
      }

      const missingFieldCases = [
        {
          field: "fullName" as const,
          expectedDetails: ["errors.fullName.required"],
        },
        {
          field: "email" as const,
          expectedDetails: ["errors.email.required"],
        },
      ];

      const results = [];

      for (const { field, expectedDetails } of missingFieldCases) {
        const request = createInquiryRequest(
          JSON.stringify(omitInquiryField(field)),
        );

        const response = await POST(request);
        const data = await response.json();

        results.push({
          status: response.status,
          data,
          expectedDetails,
        });
      }

      expect(results).toEqual(
        missingFieldCases.map(({ expectedDetails }) => ({
          status: 400,
          data: {
            success: false,
            errorCode: API_ERROR_CODES.INQUIRY_VALIDATION_FAILED,
            details: expectedDetails,
          },
          expectedDetails,
        })),
      );
      expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
      expect(processValidatedInquiry).not.toHaveBeenCalled();
    });

    it("should treat blank required inquiry fields as required before turnstile and lead processing", async () => {
      const blankRequiredFieldCases = [
        {
          field: "fullName",
          expectedDetails: ["errors.fullName.required"],
        },
        {
          field: "email",
          expectedDetails: ["errors.email.required"],
        },
      ] as const;

      const results = [];

      for (const { field, expectedDetails } of blankRequiredFieldCases) {
        const request = createInquiryRequest(
          JSON.stringify({ ...validInquiryData, [field]: "   " }),
        );

        const response = await POST(request);
        const data = await response.json();

        results.push({
          status: response.status,
          data,
          expectedDetails,
        });
      }

      expect(results).toEqual(
        blankRequiredFieldCases.map(({ expectedDetails }) => ({
          status: 400,
          data: {
            success: false,
            errorCode: API_ERROR_CODES.INQUIRY_VALIDATION_FAILED,
            details: expectedDetails,
          },
          expectedDetails,
        })),
      );
      expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
      expect(processValidatedInquiry).not.toHaveBeenCalled();
    });

    it("should reject a catalog product inquiry with a missing product identity", async () => {
      const request = createInquiryRequest(
        JSON.stringify({
          ...validInquiryData,
          catalogProductId: "",
        }),
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({
        success: false,
        errorCode: API_ERROR_CODES.INQUIRY_VALIDATION_FAILED,
        details: ["errors.generic"],
      });
      expect(processValidatedInquiry).not.toHaveBeenCalled();
    });

    it("accepts a catalog product inquiry without legacy adapter fields", async () => {
      const request = createInquiryRequest(
        JSON.stringify({
          ...validInquiryData,
          company: "Legacy Co",
          quantity: "100",
          requirements: "Legacy note",
        }),
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      const callArgs = vi.mocked(processValidatedInquiry).mock
        .calls[0]![0] as Record<string, unknown>;
      expect(callArgs).not.toHaveProperty("company");
      expect(callArgs).not.toHaveProperty("quantity");
      expect(callArgs).not.toHaveProperty("requirements");
    });

    it("should return 400 when turnstile verification fails", async () => {
      vi.mocked(verifyTurnstileDetailed).mockResolvedValueOnce({
        success: false,
      });

      const request = createInquiryRequest(JSON.stringify(validInquiryData));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe(API_ERROR_CODES.TURNSTILE_REJECTED);
    });

    it("should return 503 when turnstile verification is unavailable", async () => {
      vi.mocked(verifyTurnstileDetailed).mockResolvedValueOnce({
        success: false,
        errorCodes: ["timeout"],
      });

      const request = createInquiryRequest(JSON.stringify(validInquiryData));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe(API_ERROR_CODES.TURNSTILE_UNAVAILABLE);
      expect(processValidatedInquiry).not.toHaveBeenCalled();
    });

    it("should return success when the record is created but email fails", async () => {
      vi.mocked(processValidatedInquiry).mockResolvedValueOnce({
        success: true,
        emailSent: false,
        ownerNotified: false,
        recordCreated: true,
        referenceId: "ref-record-123",
      });

      const request = createInquiryRequest(JSON.stringify(validInquiryData));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: {
          referenceId: "ref-record-123",
        },
      });
      expect(data.errorCode).toBeUndefined();
      expect(data.data).not.toHaveProperty("partialSuccess");
    });

    it("should return processing error when the record is not created", async () => {
      vi.mocked(processValidatedInquiry).mockResolvedValueOnce({
        success: false,
        emailSent: false,
        ownerNotified: false,
        recordCreated: false,
        error: "PROCESSING_FAILED",
      });

      const request = createInquiryRequest(JSON.stringify(validInquiryData));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe(API_ERROR_CODES.INQUIRY_PROCESSING_ERROR);
      expect(data.data).toBeUndefined();
    });

    it("uses the inquiry distributed rate-limit preset", async () => {
      const request = createInquiryRequest(JSON.stringify(validInquiryData));

      await POST(request);

      expect(checkDistributedRateLimit).toHaveBeenCalledWith(
        expect.any(String),
        "inquiry",
      );
      // 一次提交只能扣一次额度。多查一次不会报错，只会让买家的配额悄悄减半。
      expect(checkDistributedRateLimit).toHaveBeenCalledTimes(1);
    });

    it("returns a success-shaped reference for a filled website honeypot", async () => {
      const request = createInquiryRequest(
        JSON.stringify({
          ...validInquiryData,
          website: "https://spam.example",
        }),
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.referenceId).toMatch(/^PRO-/);
      expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
      expect(processValidatedInquiry).not.toHaveBeenCalled();
    });

    it("should handle unexpected errors", async () => {
      vi.mocked(processValidatedInquiry).mockRejectedValueOnce(
        new Error("Unexpected error"),
      );

      const request = createInquiryRequest(JSON.stringify(validInquiryData));

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.errorCode).toBe(API_ERROR_CODES.INQUIRY_PROCESSING_ERROR);
    });

    it("should pass lead type product to processValidatedInquiry", async () => {
      const request = createInquiryRequest(JSON.stringify(validInquiryData));

      await POST(request);

      expect(processValidatedInquiry).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "product",
        }),
      );
    });

    it("should not allow request body to override lead type", async () => {
      const request = createInquiryRequest(
        JSON.stringify({
          ...validInquiryData,
          type: "contact",
        }),
      );

      await POST(request);

      expect(processValidatedInquiry).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "product",
        }),
      );
    });

    it("keeps a non-string utm value from rejecting the whole submission", async () => {
      const request = createInquiryRequest(
        JSON.stringify({ ...validInquiryData, utmSource: 123 }),
      );

      const response = await POST(request);

      // 归因字段先整组剔除、再放清洗结果，脏值到不了 schema。
      // 买家不该因为一个营销参数格式不对被整单拒绝。
      expect(response.status).toBe(200);
      const callArgs = vi.mocked(processValidatedInquiry).mock
        .calls[0]![0] as Record<string, unknown>;
      expect(callArgs).not.toHaveProperty("utmSource");
    });

    // FPH-2607-009 的防复发守卫。买家填了、路由的白名单没同步、字段被静默丢掉，
    // 是这一轮整改要根除的失败模式。
    //
    // 守的范围就到 processValidatedInquiry 为止，不是端到端：浏览器发不发、
    // 邮件收不收、Airtable 收不收，各有各的字段清单，这两条断言都管不着。
    // 新增买家字段时那三处仍要单独补证明。
    //
    // 每个字段的合法样值写在这里，但**字段名不是手抄的**：下面第一条断言拿
    // schema 的 `.shape` 跟这张表对账。给 schema 加字段而不给样值，这条立刻红——
    // 手抄的清单不会报错，只会随时间悄悄变短，正是这个 bug 的成因。
    const SAMPLE_VALUE_PER_SCHEMA_FIELD: Record<string, unknown> = {
      type: "product",
      productInquiryKind: "catalog-product",
      fullName: "Full Coverage Buyer",
      email: "coverage@example.com",
      catalogProductId: "abs-flood-barriers",
      message: "Every declared field carries a value.",
      buyerInterest: "Flood barriers",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "flood-2026",
      utmTerm: "flood barrier",
      utmContent: "hero-cta",
      gclid: "gclid-sample",
      fbclid: "fbclid-sample",
      msclkid: "msclkid-sample",
      landingPage: "/products",
      capturedAt: "2026-07-27T00:00:00.000Z",
    };

    it("keeps a sample value for every field the schema declares", () => {
      expect([...Object.keys(SAMPLE_VALUE_PER_SCHEMA_FIELD)].sort()).toEqual(
        [...Object.keys(leadSchemaModule.productLeadObjectSchema.shape)].sort(),
      );
    });

    it("forwards every field the schema declares to the lead pipeline", async () => {
      const request = createInquiryRequest(
        JSON.stringify({
          turnstileToken: "valid-token",
          ...SAMPLE_VALUE_PER_SCHEMA_FIELD,
        }),
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      // 路由要是改回逐字段枚举、漏掉其中任何一个，这里就少一个键。
      const forwarded = vi.mocked(processValidatedInquiry).mock
        .calls[0]![0] as Record<string, unknown>;
      expect([...Object.keys(forwarded)].sort()).toEqual(
        [...Object.keys(SAMPLE_VALUE_PER_SCHEMA_FIELD)].sort(),
      );
    });

    it("normalizes a blank optional field instead of rejecting it", async () => {
      const request = createInquiryRequest(
        JSON.stringify({
          ...generalRfqData,
          catalogProductId: "",
          buyerInterest: "   ",
        }),
      );

      const response = await POST(request);

      // 空串归一在 schema 里：浏览器把没填的字段发成 ""，那不是「填了一个非法值」。
      expect(response.status).toBe(200);
      const callArgs = vi.mocked(processValidatedInquiry).mock
        .calls[0]![0] as Record<string, unknown>;
      expect(callArgs.catalogProductId).toBeUndefined();
      expect(callArgs.buyerInterest).toBeUndefined();
    });

    it("should exclude turnstileToken from lead data", async () => {
      const request = createInquiryRequest(JSON.stringify(validInquiryData));

      await POST(request);

      const callArgs = vi.mocked(processValidatedInquiry).mock.calls[0]![0];
      expect(callArgs).not.toHaveProperty("turnstileToken");
    });
  });

  describe("OPTIONS", () => {
    it("should return 200 with CORS headers for allowed origin", async () => {
      const request = new NextRequest("http://localhost:3000/api/inquiry", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:3000",
          Host: "localhost:3000",
        },
      });

      const response = OPTIONS(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3000",
      );
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
        "POST",
      );
    });

    it("should return empty body", async () => {
      const request = new NextRequest("http://localhost:3000/api/inquiry", {
        method: "OPTIONS",
        headers: { Host: "localhost:3000" },
      });

      const response = OPTIONS(request);
      const body = await response.text();

      expect(body).toBe("");
    });
  });
});
