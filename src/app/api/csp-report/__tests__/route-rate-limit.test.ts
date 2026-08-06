/**
 * CSP Report API Route - Rate Limiting Tests
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCheckDistributedRateLimit = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    allowed: true,
    remaining: 99,
    resetTime: Date.now() + 60000,
    retryAfter: null,
  }),
);

const mockCreateRateLimitHeaders = vi.hoisted(() =>
  vi.fn().mockImplementation((result) => {
    const headers = new Headers();
    headers.set("X-RateLimit-Remaining", String(result.remaining));
    headers.set("X-RateLimit-Reset", String(result.resetTime));
    if (result.retryAfter !== null) {
      headers.set("Retry-After", String(result.retryAfter));
    }
    return headers;
  }),
);

vi.mock("@/lib/security/distributed-rate-limit", () => ({
  checkDistributedRateLimit: mockCheckDistributedRateLimit,
  createRateLimitHeaders: mockCreateRateLimitHeaders,
  RATE_LIMIT_PRESETS: {
    csp: {
      maxRequests: 100,
      windowMs: 60_000,
      failureMode: "closed",
    },
  },
}));

vi.mock("@/lib/security/rate-limit-key-strategies", () => ({
  getIPKey: vi.fn(async () => "ip:test-key"),
}));

vi.mock("@/lib/security/client-ip", () => ({
  getClientIP: vi.fn(() => "192.168.1.1"),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  // Keep exports compatible with production module shape.
  // Route code sanitizes before logging; tests don't assert on sanitization details here.
  sanitizeIP: vi.fn(() => "[REDACTED_IP]"),
  sanitizeLogContext: vi.fn((context: Record<string, unknown>) => context),
}));

vi.mock("@/lib/env", () => {
  const env = {
    NODE_ENV: "production",
    CSP_REPORT_URI: "https://example.com/csp-report",
  };

  return {
    env,
    runtimeEnv: env,
    isRuntimeProduction: () => true,
    getRuntimeEnvString: (key: string) => {
      if (key === "NODE_ENV") return "production";
      if (key === "CSP_REPORT_URI") return "https://example.com/csp-report";
      if (key === "RATE_LIMIT_PEPPER")
        return "test-rate-limit-pepper-0123456789abcdef";
      return process.env[key];
    },
  };
});

describe("CSP Report API Route - Rate Limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The global test setup runs vi.resetAllMocks() before each test, which
    // wipes hoisted mock implementations. Re-establish createRateLimitHeaders
    // so it keeps honoring its production `Headers` return-type contract.
    mockCreateRateLimitHeaders.mockImplementation((result) => {
      const headers = new Headers();
      headers.set("X-RateLimit-Remaining", String(result.remaining));
      headers.set("X-RateLimit-Reset", String(result.resetTime));
      if (result.retryAfter !== null) {
        headers.set("Retry-After", String(result.retryAfter));
      }
      return headers;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validCSPReport = {
    "csp-report": {
      "document-uri": "https://example.com/page",
      "violated-directive": "script-src",
      "blocked-uri": "https://external.com/script.js",
    },
  };

  const createRequest = (ip = "192.168.1.1") =>
    new NextRequest("http://localhost:3000/api/csp-report", {
      method: "POST",
      body: JSON.stringify(validCSPReport),
      headers: {
        "content-type": "application/csp-report",
        "x-forwarded-for": ip,
      },
    });

  describe("Rate limit enforcement", () => {
    it("should allow requests within rate limit", async () => {
      mockCheckDistributedRateLimit.mockResolvedValueOnce({
        allowed: true,
        remaining: 99,
        resetTime: Date.now() + 60000,
        retryAfter: null,
      });

      const { POST } = await import("../route");
      const response = await POST(createRequest());

      expect(response.status).toBe(200);
      expect(mockCheckDistributedRateLimit).toHaveBeenCalledWith(
        "ip:test-key",
        "csp",
      );

      const [identifier] = mockCheckDistributedRateLimit.mock.calls[0] ?? [];
      expect(String(identifier)).not.toContain("192.168.1.1");
    });

    it("should return 429 when rate limit exceeded", async () => {
      mockCheckDistributedRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        retryAfter: 60,
      });

      const { POST } = await import("../route");
      const response = await POST(createRequest());
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.errorCode).toBe("RATE_LIMIT_EXCEEDED");
    });
  });
});
