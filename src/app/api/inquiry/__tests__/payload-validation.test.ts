/**
 * 载荷校验 lane：schema 校验失败必须在 Turnstile 与投递之前返回。
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { processValidatedInquiry } from "@/lib/lead-pipeline/process-lead";
import { verifyTurnstileDetailed } from "@/lib/security/turnstile";
import {
  createInquiryRequest,
  routeMocks,
  validInquiryData,
} from "./route-harness";
import { POST } from "../route";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  sanitizeIP: (ip: string | undefined | null) =>
    ip ? "[REDACTED_IP]" : "[NO_IP]",
  sanitizeEmail: (email: string | undefined | null) =>
    email ? "[REDACTED_EMAIL]" : "[NO_EMAIL]",
}));
vi.mock("@/lib/security/rate-limit-key-strategies", async () => {
  const { routeMocks } = await import("./route-harness");
  return { getIPKey: routeMocks.getIPKey };
});
vi.mock("@/lib/security/distributed-rate-limit", async () => {
  const { routeMocks } = await import("./route-harness");
  return { checkInquiryRateLimit: routeMocks.checkInquiryRateLimit };
});
vi.mock("@/lib/lead-pipeline/process-lead", async () => {
  const { routeMocks } = await import("./route-harness");
  return { processValidatedInquiry: routeMocks.processValidatedInquiry };
});
vi.mock("@/lib/security/turnstile", async () => {
  const { routeMocks } = await import("./route-harness");
  return { verifyTurnstileDetailed: routeMocks.verifyTurnstileDetailed };
});
vi.mock("@/config/offerings", async () => import("@/test/offerings"));

describe("/api/inquiry payload validation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return 400 for invalid JSON", async () => {
    const request = createInquiryRequest("invalid json");

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      success: false,
      errorCode: API_ERROR_CODES.INVALID_JSON_BODY,
    });
    expect(response.headers.get("x-request-id")).toBeNull();
    expect(response.headers.get("x-observability-surface")).toBeNull();
    expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
    expect(processValidatedInquiry).not.toHaveBeenCalled();
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

  it("should return 400 when turnstile token is missing", async () => {
    const dataWithoutToken = { ...validInquiryData };
    delete (dataWithoutToken as { turnstileToken?: string }).turnstileToken;

    const request = createInquiryRequest(JSON.stringify(dataWithoutToken));

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      success: false,
      errorCode: API_ERROR_CODES.TURNSTILE_REQUIRED,
    });
    expect(response.headers.get("x-request-id")).toBeNull();
    expect(response.headers.get("x-observability-surface")).toBeNull();
    expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
    expect(processValidatedInquiry).not.toHaveBeenCalled();
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

  it("keeps a non-string utm value from rejecting the whole submission", async () => {
    const request = createInquiryRequest(
      JSON.stringify({ ...validInquiryData, utmSource: 123 }),
    );

    const response = await POST(request);

    // 归因字段先整组剔除、再放清洗结果，脏值到不了 schema。
    // 买家不该因为一个营销参数格式不对被整单拒绝。
    expect(response.status).toBe(200);
    const callArgs = vi.mocked(routeMocks.processValidatedInquiry).mock
      .calls[0]![0] as Record<string, unknown>;
    expect(callArgs).not.toHaveProperty("utmSource");
  });
});
