/**
 * 请求准入 lane：media type 检查与 Origin gate 必须发生在限流配额消耗之前。
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkInquiryRateLimit } from "@/lib/security/distributed-rate-limit";
import { processValidatedInquiry } from "@/lib/lead-pipeline/process-lead";
import { createInquiryRequest, validInquiryData } from "./route-harness";
import { OPTIONS, POST } from "../route";

vi.mock("@/lib/observability/inquiry-failure-latch", () => ({
  recordInquiryIncident: vi.fn(async () => undefined),
}));
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

describe("/api/inquiry request admission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // S-F01 回归锁：垃圾请求必须在消耗限流配额之前被丢弃。
  it("rejects non-JSON content-type with 415 before consuming rate-limit quota", async () => {
    const response = await POST(
      createInquiryRequest(JSON.stringify(validInquiryData), {
        "Content-Type": "text/plain",
      }),
    );

    expect(response.status).toBe(415);
    // 关键断言：限流存储根本不该被触碰。
    expect(checkInquiryRateLimit).not.toHaveBeenCalled();
    expect(processValidatedInquiry).not.toHaveBeenCalled();
  });

  it("rejects prefix-confused media types like application/jsonx with 415", async () => {
    const response = await POST(
      createInquiryRequest(JSON.stringify(validInquiryData), {
        "Content-Type": "Application/JSONX",
      }),
    );

    expect(response.status).toBe(415);
    expect(checkInquiryRateLimit).not.toHaveBeenCalled();
  });

  it("accepts application/json with charset parameter", async () => {
    const response = await POST(
      createInquiryRequest(JSON.stringify(validInquiryData), {
        "Content-Type": "application/json; charset=utf-8",
      }),
    );

    expect(response.status).toBe(200);
  });

  it("rejects missing content-type with 415 before rate limiting", async () => {
    const request = new NextRequest("http://localhost:3000/api/inquiry", {
      method: "POST",
      body: JSON.stringify(validInquiryData),
    });

    const response = await POST(request);

    expect(response.status).toBe(415);
    expect(checkInquiryRateLimit).not.toHaveBeenCalled();
  });

  it("rejects cross-site Origin with 403 before consuming rate-limit quota", async () => {
    const response = await POST(
      createInquiryRequest(JSON.stringify(validInquiryData), {
        Origin: "https://evil.example",
      }),
    );

    expect(response.status).toBe(403);
    expect(checkInquiryRateLimit).not.toHaveBeenCalled();
    expect(processValidatedInquiry).not.toHaveBeenCalled();
  });

  it("accepts same-origin Origin and proceeds to normal flow", async () => {
    const response = await POST(
      createInquiryRequest(JSON.stringify(validInquiryData), {
        Origin: "http://localhost:3000",
      }),
    );

    expect(response.status).toBe(200);
    expect(checkInquiryRateLimit).toHaveBeenCalledTimes(1);
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
