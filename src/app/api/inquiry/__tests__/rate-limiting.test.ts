/**
 * 限流 lane：配额判定，以及存储故障与私钥派生失败时询盘放行的行为。
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { checkInquiryRateLimit } from "@/lib/security/distributed-rate-limit";
import { logger } from "@/lib/logger";
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

describe("/api/inquiry rate limiting", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return 429 when rate limited", async () => {
    routeMocks.checkInquiryRateLimit.mockResolvedValueOnce({
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
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response.headers.get("Retry-After")).toBe("60");
    // 限流是第一道闸：被挡住的请求不该消耗一次 Turnstile token，也不该产生投递。
    expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
    expect(processValidatedInquiry).not.toHaveBeenCalled();
  });

  it("lets the inquiry through and logs a warning when the rate-limit store fails", async () => {
    routeMocks.checkInquiryRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
      retryAfter: 60,
      deniedReason: "storage_failure",
    });

    const response = await POST(
      createInquiryRequest(JSON.stringify(validInquiryData)),
    );

    expect(response.status).toBe(200);
    // 限流存储故障不能挡住买家；Turnstile 仍是反滥用闸门，交付照常进行。
    expect(verifyTurnstileDetailed).toHaveBeenCalledTimes(1);
    expect(processValidatedInquiry).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "Rate limit unavailable; allowing inquiry to proceed",
      expect.objectContaining({ reason: "storage_failure" }),
    );
  });

  it("lets the inquiry through and logs an error when the private rate-limit key cannot be created", async () => {
    routeMocks.getIPKey.mockRejectedValueOnce(new Error("pepper missing"));

    const response = await POST(
      createInquiryRequest(JSON.stringify(validInquiryData)),
    );

    expect(response.status).toBe(200);
    expect(checkInquiryRateLimit).not.toHaveBeenCalled();
    expect(verifyTurnstileDetailed).toHaveBeenCalledTimes(1);
    expect(processValidatedInquiry).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      "Rate limit unavailable; allowing inquiry to proceed",
      expect.objectContaining({ reason: "key_failure" }),
    );
  });

  it("still rejects bots at Turnstile when the rate-limit store fails", async () => {
    routeMocks.checkInquiryRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
      retryAfter: 60,
      deniedReason: "storage_failure",
    });
    routeMocks.verifyTurnstileDetailed.mockResolvedValueOnce({
      status: "failed",
    });

    const response = await POST(
      createInquiryRequest(JSON.stringify(validInquiryData)),
    );

    expect(response.status).toBe(400);
    expect(processValidatedInquiry).not.toHaveBeenCalled();
  });

  it("checks the inquiry rate limit exactly once", async () => {
    const request = createInquiryRequest(JSON.stringify(validInquiryData));

    await POST(request);

    expect(checkInquiryRateLimit).toHaveBeenCalledWith(expect.any(String));
    // 一次提交只能扣一次额度。多查一次不会报错，只会让买家的配额悄悄减半。
    expect(checkInquiryRateLimit).toHaveBeenCalledTimes(1);
  });
});
