import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withRateLimit, type RateLimitContext } from "../with-rate-limit";

// Use vi.hoisted for mock functions to ensure proper initialization
const mockCheckDistributedRateLimit = vi.hoisted(() => vi.fn());
const mockCreateRateLimitHeaders = vi.hoisted(() => vi.fn());
const mockGetClientIP = vi.hoisted(() => vi.fn());
const mockGetIPKey = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/security/distributed-rate-limit", () => ({
  checkDistributedRateLimit: mockCheckDistributedRateLimit,
  createRateLimitHeaders: mockCreateRateLimitHeaders,
}));

vi.mock("@/lib/security/client-ip", () => ({
  getClientIP: mockGetClientIP,
}));

vi.mock("@/lib/security/rate-limit-key-strategies", () => ({
  getIPKey: mockGetIPKey,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: mockLoggerWarn,
    error: mockLoggerError,
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("withRateLimit", () => {
  const TEST_CLIENT_IP = "192.168.1.100";
  const TEST_RATE_LIMIT_KEY = "ip:abc123def456";

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockGetClientIP.mockReturnValue(TEST_CLIENT_IP);
    mockGetIPKey.mockReturnValue(TEST_RATE_LIMIT_KEY);
    mockCreateRateLimitHeaders.mockReturnValue(new Headers());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  function createMockRequest(
    url = "http://localhost/api/test",
    options: RequestInit = {},
  ): NextRequest {
    const { headers, signal, ...rest } = options;
    const mergedHeaders = new Headers({ "Content-Type": "application/json" });
    if (headers) {
      new Headers(headers as HeadersInit).forEach((value, key) => {
        mergedHeaders.set(key, value);
      });
    }
    return new NextRequest(url, {
      method: "POST",
      headers: mergedHeaders,
      ...rest,
      ...(signal ? { signal } : {}),
    });
  }

  function createMockHandler<T>(response: T, status = 200) {
    return vi.fn().mockResolvedValue(NextResponse.json(response, { status }));
  }

  describe("rate limit passed", () => {
    it("should call handler when rate limit allows", async () => {
      mockCheckDistributedRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 4,
        resetTime: Date.now() + 60000,
        retryAfter: null,
      });

      const mockHandler = createMockHandler({ success: true });
      const wrappedHandler = withRateLimit("inquiry", mockHandler);

      const request = createMockRequest();
      const response = await wrappedHandler(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ success: true });
      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(
        request,
        expect.objectContaining({ clientIP: TEST_CLIENT_IP }),
      );
    });

    it("should inject clientIP into handler context", async () => {
      mockCheckDistributedRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 4,
        resetTime: Date.now() + 60000,
        retryAfter: null,
      });

      let capturedContext: RateLimitContext | undefined;
      const mockHandler = vi.fn().mockImplementation((_req, ctx) => {
        capturedContext = ctx;
        return NextResponse.json({ success: true });
      });

      const wrappedHandler = withRateLimit("inquiry", mockHandler);
      await wrappedHandler(createMockRequest());

      expect(capturedContext).toBeDefined();
      expect(capturedContext?.clientIP).toBe(TEST_CLIENT_IP);
    });

    it("should use correct preset for rate limit check", async () => {
      mockCheckDistributedRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 4,
        resetTime: Date.now() + 60000,
        retryAfter: null,
      });

      const mockHandler = createMockHandler({ success: true });
      const wrappedHandler = withRateLimit("inquiry", mockHandler);

      await wrappedHandler(createMockRequest());

      expect(mockCheckDistributedRateLimit).toHaveBeenCalledWith(
        TEST_RATE_LIMIT_KEY,
        "inquiry",
      );
    });
  });

  describe("rate limit exceeded", () => {
    it("should return 429 when rate limit exceeded", async () => {
      const retryAfterSeconds = 30;
      mockCheckDistributedRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 30000,
        retryAfter: retryAfterSeconds,
      });

      const mockHeaders = new Headers();
      mockHeaders.set("Retry-After", String(retryAfterSeconds));
      mockHeaders.set("X-RateLimit-Remaining", "0");
      mockCreateRateLimitHeaders.mockReturnValue(mockHeaders);

      const mockHandler = createMockHandler({ success: true });
      const wrappedHandler = withRateLimit("inquiry", mockHandler);

      const response = await wrappedHandler(createMockRequest());
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body).toEqual({
        success: false,
        errorCode: "RATE_LIMIT_EXCEEDED",
      });
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("should include rate limit headers in 429 response", async () => {
      const retryAfterSeconds = 45;
      mockCheckDistributedRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 45000,
        retryAfter: retryAfterSeconds,
      });

      const mockHeaders = new Headers();
      mockHeaders.set("Retry-After", String(retryAfterSeconds));
      mockHeaders.set("X-RateLimit-Remaining", "0");
      mockHeaders.set("X-RateLimit-Reset", String(Date.now() + 45000));
      mockCreateRateLimitHeaders.mockReturnValue(mockHeaders);

      const wrappedHandler = withRateLimit(
        "inquiry",
        createMockHandler({ success: true }),
      );

      const response = await wrappedHandler(createMockRequest());

      expect(response.headers.get("Retry-After")).toBe(
        String(retryAfterSeconds),
      );
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    });

    it("should log rate limit exceeded with safe key prefix", async () => {
      mockCheckDistributedRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        retryAfter: 60,
      });
      mockCreateRateLimitHeaders.mockReturnValue(new Headers());

      const wrappedHandler = withRateLimit(
        "inquiry",
        createMockHandler({ success: true }),
      );

      await wrappedHandler(createMockRequest());

      expect(mockLoggerWarn).toHaveBeenCalledWith(
        "Rate limit exceeded",
        expect.objectContaining({
          keyPrefix: expect.any(String),
          retryAfter: 60,
        }),
      );
      // Verify key prefix is truncated to 8 chars for privacy
      const [logCall] = mockLoggerWarn.mock.calls;
      if (!logCall) {
        throw new Error("Expected logger.warn to be called at least once");
      }
      const details = logCall[1];
      if (!details || typeof details !== "object") {
        throw new Error("Expected logger.warn second arg to be an object");
      }
      expect(
        (details as { keyPrefix: string }).keyPrefix.length,
      ).toBeLessThanOrEqual(8);
    });
    it("should return 503 with SERVICE_UNAVAILABLE errorCode when storage fails for fail-closed preset", async () => {
      mockCheckDistributedRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        retryAfter: 60,
        deniedReason: "storage_failure" as const,
      });
      mockCreateRateLimitHeaders.mockReturnValue(new Headers());

      const mockHandler = createMockHandler({ success: true });
      const wrappedHandler = withRateLimit("inquiry", mockHandler);

      const response = await wrappedHandler(createMockRequest());
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body).toEqual({
        success: false,
        errorCode: "SERVICE_UNAVAILABLE",
      });
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("should return 503 when key generation fails before the rate-limit check", async () => {
      const mockHandler = createMockHandler({ success: true });
      const wrappedHandler = withRateLimit("inquiry", mockHandler, () => {
        throw new Error("pepper missing");
      });

      const response = await wrappedHandler(createMockRequest());
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body).toEqual({
        success: false,
        errorCode: "SERVICE_UNAVAILABLE",
      });
      expect(mockCheckDistributedRateLimit).not.toHaveBeenCalled();
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe("custom key strategy", () => {
    it("should use custom key strategy when provided", async () => {
      const customKey = "session:custom123";
      const customKeyStrategy = vi.fn().mockReturnValue(customKey);

      mockCheckDistributedRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 4,
        resetTime: Date.now() + 60000,
        retryAfter: null,
      });

      const wrappedHandler = withRateLimit(
        "inquiry",
        createMockHandler({ success: true }),
        customKeyStrategy,
      );

      const request = createMockRequest();
      await wrappedHandler(request);

      expect(customKeyStrategy).toHaveBeenCalledWith(request);
      expect(mockCheckDistributedRateLimit).toHaveBeenCalledWith(
        customKey,
        "inquiry",
      );
    });

    it("should default to getIPKey strategy", async () => {
      mockCheckDistributedRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 4,
        resetTime: Date.now() + 60000,
        retryAfter: null,
      });

      const wrappedHandler = withRateLimit(
        "inquiry",
        createMockHandler({ success: true }),
      );

      const request = createMockRequest();
      await wrappedHandler(request);

      expect(mockGetIPKey).toHaveBeenCalledWith(request);
    });
  });

  describe("response type preservation", () => {
    it("should preserve generic type through wrapper", async () => {
      interface TestResponse {
        data: string;
        count: number;
      }

      mockCheckDistributedRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 4,
        resetTime: Date.now() + 60000,
        retryAfter: null,
      });

      const expectedResponse: TestResponse = { data: "test", count: 42 };
      const mockHandler = createMockHandler(expectedResponse);

      const wrappedHandler = withRateLimit<TestResponse>(
        "inquiry",
        mockHandler,
      );
      const response = await wrappedHandler(createMockRequest());
      const body = await response.json();

      expect(body).toEqual(expectedResponse);
    });
  });
});
