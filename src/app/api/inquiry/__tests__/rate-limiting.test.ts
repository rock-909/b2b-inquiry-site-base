/**
 * 限流 lane：配额判定、存储故障与私钥派生失败的降级行为。
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { checkInquiryRateLimit } from "@/lib/security/distributed-rate-limit";
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

  it("should return 503 when the rate-limit store fails", async () => {
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
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.errorCode).toBe(API_ERROR_CODES.SERVICE_UNAVAILABLE);
    expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
    expect(processValidatedInquiry).not.toHaveBeenCalled();
  });

  it("should return 503 when the private rate-limit key cannot be created", async () => {
    routeMocks.getIPKey.mockRejectedValueOnce(new Error("pepper missing"));

    const response = await POST(
      createInquiryRequest(JSON.stringify(validInquiryData)),
    );
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.errorCode).toBe(API_ERROR_CODES.SERVICE_UNAVAILABLE);
    expect(checkInquiryRateLimit).not.toHaveBeenCalled();
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
