/**
 * 投递 lane：成功路径、部分失败、处理错误、蜜罐与 schema 字段覆盖合同。
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import * as leadSchemaModule from "@/lib/lead-pipeline/lead-schema";
import {
  createInquiryRequest,
  generalInquiryData,
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

describe("/api/inquiry lead delivery", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a general inquiry with no offering identity", async () => {
    const request = createInquiryRequest(JSON.stringify(generalInquiryData));

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    const callArgs = vi.mocked(routeMocks.processValidatedInquiry).mock
      .calls[0]![0] as Record<string, unknown>;
    expect(callArgs.type).toBe("inquiry");
    expect(callArgs.offeringId).toBeUndefined();
  });

  it("passes attribution fields to processValidatedInquiry", async () => {
    const request = createInquiryRequest(
      JSON.stringify({
        ...validInquiryData,
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "sample-campaign",
        landingPage: "/en/contact",
        capturedAt: "2026-07-04T00:00:00.000Z",
      }),
    );

    await POST(request);

    expect(routeMocks.processValidatedInquiry).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "inquiry",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "sample-campaign",
        landingPage: "/en/contact",
        capturedAt: "2026-07-04T00:00:00.000Z",
      }),
    );
  });

  it("should process valid inquiry without a replay key", async () => {
    const request = createInquiryRequest(JSON.stringify(validInquiryData));

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(routeMocks.processValidatedInquiry).toHaveBeenCalledTimes(1);
  });

  it("should process repeated valid inquiry requests independently", async () => {
    const firstRequest = createInquiryRequest(JSON.stringify(validInquiryData));
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
    expect(routeMocks.processValidatedInquiry).toHaveBeenCalledTimes(2);
  });

  it("should return success when the record is created but email fails", async () => {
    routeMocks.processValidatedInquiry.mockResolvedValueOnce({
      success: true,
      emailSent: false,
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
    routeMocks.processValidatedInquiry.mockResolvedValueOnce({
      success: false,
      emailSent: false,
      recordCreated: false,
      error: "PROCESSING_FAILED",
    });

    const request = createInquiryRequest(JSON.stringify(validInquiryData));

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      success: false,
      errorCode: API_ERROR_CODES.INQUIRY_PROCESSING_ERROR,
    });
    expect(response.headers.get("x-request-id")).toBeNull();
    expect(response.headers.get("x-observability-surface")).toBeNull();
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
    expect(data.data.referenceId).toMatch(/^INQ-/);
    expect(routeMocks.verifyTurnstileDetailed).not.toHaveBeenCalled();
    expect(routeMocks.processValidatedInquiry).not.toHaveBeenCalled();
  });

  it("should handle unexpected errors", async () => {
    routeMocks.processValidatedInquiry.mockRejectedValueOnce(
      new Error("Unexpected error"),
    );

    const request = createInquiryRequest(JSON.stringify(validInquiryData));

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.errorCode).toBe(API_ERROR_CODES.INQUIRY_PROCESSING_ERROR);
  });

  it("should pass lead type inquiry to processValidatedInquiry", async () => {
    const request = createInquiryRequest(JSON.stringify(validInquiryData));

    await POST(request);

    expect(routeMocks.processValidatedInquiry).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "inquiry",
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

    expect(routeMocks.processValidatedInquiry).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "inquiry",
      }),
    );
  });

  it("normalizes a blank offering id to general inquiry", async () => {
    const request = createInquiryRequest(
      JSON.stringify({
        ...validInquiryData,
        offeringId: "",
      }),
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    const callArgs = vi.mocked(routeMocks.processValidatedInquiry).mock
      .calls[0]![0] as Record<string, unknown>;
    expect(callArgs.offeringId).toBeUndefined();
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
    type: "inquiry",
    fullName: "Full Coverage Buyer",
    email: "coverage@example.com",
    message: "Every declared field carries a value.",
    utmSource: "google",
    utmMedium: "cpc",
    utmCampaign: "sample-2026",
    utmTerm: "sample offering",
    utmContent: "hero-cta",
    landingPage: "/products",
    capturedAt: "2026-07-27T00:00:00.000Z",
  };

  it("keeps a sample value for every field the schema declares", () => {
    expect([...Object.keys(SAMPLE_VALUE_PER_SCHEMA_FIELD)].sort()).toEqual(
      [...Object.keys(leadSchemaModule.inquiryLeadObjectSchema.shape)].sort(),
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
    const forwarded = vi.mocked(routeMocks.processValidatedInquiry).mock
      .calls[0]![0] as Record<string, unknown>;
    expect([...Object.keys(forwarded)].sort()).toEqual(
      [...Object.keys(SAMPLE_VALUE_PER_SCHEMA_FIELD)].sort(),
    );
  });

  it("normalizes a blank optional field instead of rejecting it", async () => {
    const request = createInquiryRequest(
      JSON.stringify({
        ...generalInquiryData,
        message: "",
      }),
    );

    const response = await POST(request);

    // 空串归一在 schema 里：浏览器把没填的字段发成 ""，那不是「填了一个非法值」。
    expect(response.status).toBe(200);
    const callArgs = vi.mocked(routeMocks.processValidatedInquiry).mock
      .calls[0]![0] as Record<string, unknown>;
    expect(callArgs.message).toBeUndefined();
  });

  it("should exclude turnstileToken from lead data", async () => {
    const request = createInquiryRequest(JSON.stringify(validInquiryData));

    await POST(request);

    const callArgs = vi.mocked(routeMocks.processValidatedInquiry).mock
      .calls[0]![0];
    expect(callArgs).not.toHaveProperty("turnstileToken");
  });
});
