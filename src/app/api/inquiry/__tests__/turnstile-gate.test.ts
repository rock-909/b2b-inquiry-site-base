/**
 * Turnstile lane：路由把浏览器 token 交给验证、验证失败与验证服务不可用的降级。
 * action / hostname / 绕过 / 缺密钥等服务端防线由 src/lib/security/__tests__/turnstile-guards.test.ts 覆盖。
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

describe("/api/inquiry turnstile gate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("verifies the browser-submitted Turnstile token exactly once", async () => {
    const request = createInquiryRequest(JSON.stringify(validInquiryData));

    await POST(request);

    expect(verifyTurnstileDetailed).toHaveBeenCalledTimes(1);
    expect(verifyTurnstileDetailed).toHaveBeenCalledWith(
      validInquiryData.turnstileToken,
      expect.any(String),
    );
  });

  it("should return 400 when turnstile verification fails", async () => {
    routeMocks.verifyTurnstileDetailed.mockResolvedValueOnce({
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
    routeMocks.verifyTurnstileDetailed.mockResolvedValueOnce({
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
});
