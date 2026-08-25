import { beforeEach, describe, expect, it, vi } from "vitest";
import { processValidatedInquiry } from "@/lib/lead-pipeline/process-lead";
import { recordInquiryIncident } from "@/lib/observability/inquiry-failure-latch";
import { checkInquiryRateLimit } from "@/lib/security/distributed-rate-limit";
import { verifyTurnstileDetailed } from "@/lib/security/turnstile";
import { NextRequest } from "next/server";
import { POST } from "../route";

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

vi.mock("@/lib/observability/inquiry-failure-latch", () => ({
  recordInquiryIncident: vi.fn(async () => undefined),
}));

vi.mock("@/lib/lead-pipeline/process-lead", () => ({
  processValidatedInquiry: vi.fn(async () => ({
    success: true,
    emailSent: true,
    recordCreated: true,
    referenceId: "ref-123",
  })),
}));

vi.mock("@/lib/security/rate-limit-key-strategies", () => ({
  getIPKey: vi.fn(async () => "ip:abc123def456"),
}));

vi.mock("@/lib/security/distributed-rate-limit", () => ({
  checkInquiryRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 5,
    resetTime: Date.now() + 60000,
    retryAfter: null,
  })),
}));

vi.mock("@/lib/security/turnstile", () => ({
  verifyTurnstileDetailed: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@/config/offerings", async () => import("@/test/offerings"));

vi.mock("@/lib/api/cors-utils", () => ({
  applyCorsHeaders: vi.fn(({ response }: { response: unknown }) => response),
  createCorsPreflightResponse: vi.fn(() => new Response(null, { status: 204 })),
}));

describe("inquiry incident latch triggers", () => {
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
    global.fetch = vi.fn(async () =>
      Response.json({ success: true, data: {} }),
    );
    vi.mocked(recordInquiryIncident).mockClear();
  });

  async function submitWith(payload: Record<string, unknown>): Promise<void> {
    const request = createInquiryRequest(JSON.stringify(payload));
    await POST(request);
  }

  it("latches email_delivery_failed when only email fails", async () => {
    vi.mocked(processValidatedInquiry).mockResolvedValueOnce({
      success: true,
      emailSent: false,
      recordCreated: true,
      referenceId: "INQ-email-fail",
    });

    await submitWith({
      turnstileToken: "valid-token",
      fullName: "Jane",
      email: "jane@example.com",
    });

    expect(recordInquiryIncident).toHaveBeenCalledWith(
      "email_delivery_failed",
      "INQ-email-fail",
    );
  });

  it("latches airtable_delivery_failed when only Airtable fails", async () => {
    vi.mocked(processValidatedInquiry).mockResolvedValueOnce({
      success: true,
      emailSent: true,
      recordCreated: false,
      referenceId: "INQ-at-fail",
    });

    await submitWith({
      turnstileToken: "valid-token",
      fullName: "Jane",
      email: "jane@example.com",
    });

    expect(recordInquiryIncident).toHaveBeenCalledWith(
      "airtable_delivery_failed",
      "INQ-at-fail",
    );
  });

  it("latches delivery_failed when both channels fail", async () => {
    vi.mocked(processValidatedInquiry).mockResolvedValueOnce({
      success: false,
      emailSent: false,
      recordCreated: false,
      referenceId: "INQ-all-fail",
      error: "PROCESSING_FAILED",
    });

    await submitWith({
      turnstileToken: "valid-token",
      fullName: "Jane",
      email: "jane@example.com",
    });

    expect(recordInquiryIncident).toHaveBeenCalledWith(
      "delivery_failed",
      "INQ-all-fail",
    );
  });

  it("does not latch on full success", async () => {
    await submitWith({
      turnstileToken: "valid-token",
      fullName: "Jane",
      email: "jane@example.com",
    });

    expect(recordInquiryIncident).not.toHaveBeenCalled();
  });

  it("latches turnstile_unavailable when Cloudflare siteverify is unreachable", async () => {
    vi.mocked(verifyTurnstileDetailed).mockResolvedValueOnce({
      success: false,
      errorCodes: ["network-error"],
    });

    await submitWith({
      turnstileToken: "valid-token",
      fullName: "Jane",
      email: "jane@example.com",
    });

    expect(recordInquiryIncident).toHaveBeenCalledWith("turnstile_unavailable");
  });

  it("does not latch a normal Turnstile token rejection", async () => {
    vi.mocked(verifyTurnstileDetailed).mockResolvedValueOnce({
      success: false,
      errorCodes: ["invalid-input-response"],
    });

    await submitWith({
      turnstileToken: "bad-token",
      fullName: "Jane",
      email: "jane@example.com",
    });

    expect(recordInquiryIncident).not.toHaveBeenCalled();
  });

  it("latches unexpected_inquiry_error when the handler throws", async () => {
    // processValidatedInquiry 自身吞掉内部异常并返回失败结果，
    // 所以这里让 payload 解析之后的更深层抛错：mock 投递函数抛出。
    vi.mocked(processValidatedInquiry).mockRejectedValueOnce(new Error("boom"));

    await submitWith({
      turnstileToken: "valid-token",
      fullName: "Jane",
      email: "jane@example.com",
    });

    expect(recordInquiryIncident).toHaveBeenCalledWith(
      "unexpected_inquiry_error",
    );
  });

  it("latches rate_limit_store_unavailable on storage failure", async () => {
    vi.mocked(checkInquiryRateLimit).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
      retryAfter: null,
      deniedReason: "storage_failure",
    });

    await submitWith({ fullName: "Jane", email: "jane@example.com" });

    expect(recordInquiryIncident).toHaveBeenCalledWith(
      "rate_limit_store_unavailable",
    );
  });
});
