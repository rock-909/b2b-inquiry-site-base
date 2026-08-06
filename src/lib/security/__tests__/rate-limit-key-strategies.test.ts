import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getIPKey,
  hmacKey,
  resetPepperWarning,
} from "../rate-limit-key-strategies";

// Use vi.hoisted for mock functions
const mockGetClientIP = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());

vi.mock("@/lib/security/client-ip", () => ({
  getClientIP: mockGetClientIP,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: mockLoggerWarn,
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

/**
 * Type-safe environment variable helper for tests.
 * Bypasses TypeScript's read-only process.env constraint.
 */
function setEnv(key: string, value: string | undefined): void {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) {
    delete env[key];
  } else {
    env[key] = value;
  }
}

describe("rate-limit-key-strategies", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    resetPepperWarning();
    // Reset environment
    process.env = { ...originalEnv };
    setEnv("RATE_LIMIT_PEPPER", undefined);
    setEnv("NODE_ENV", undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
    process.env = originalEnv;
  });

  function createMockRequest(
    options: {
      cookies?: Record<string, string>;
      headers?: Record<string, string>;
    } = {},
  ): NextRequest {
    const url = "http://localhost/api/test";
    const headers = new Headers(options.headers);

    const request = new NextRequest(url, { headers });

    // Mock cookies
    if (options.cookies) {
      Object.defineProperty(request.cookies, "get", {
        value: vi.fn().mockImplementation((cookieName: string) => {
          if (options.cookies && cookieName in options.cookies) {
            return { value: options.cookies[cookieName] };
          }
          return undefined;
        }),
      });
    }

    return request;
  }

  describe("hmacKey", () => {
    it("should generate consistent hash for same input", async () => {
      setEnv("RATE_LIMIT_PEPPER", "a".repeat(32));

      const key1 = await hmacKey("192.168.1.1");
      const key2 = await hmacKey("192.168.1.1");

      expect(key1).toBe(key2);
    });

    it("should generate different hash for different inputs", async () => {
      setEnv("RATE_LIMIT_PEPPER", "a".repeat(32));

      const key1 = await hmacKey("192.168.1.1");
      const key2 = await hmacKey("192.168.1.2");

      expect(key1).not.toBe(key2);
    });

    it("should return 16 character hex string (64-bit)", async () => {
      setEnv("RATE_LIMIT_PEPPER", "a".repeat(32));

      const key = await hmacKey("test-input");

      expect(key).toHaveLength(16);
      expect(key).toMatch(/^[0-9a-f]{16}$/);
    });

    it("should use development fallback pepper when not configured", async () => {
      setEnv("NODE_ENV", "development");

      const key = await hmacKey("test-input");

      expect(key).toHaveLength(16);
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        "[Rate Limit] RATE_LIMIT_PEPPER not configured. Using default development pepper. This is insecure - set RATE_LIMIT_PEPPER for production.",
      );
    });

    it("should warn only once about missing pepper", async () => {
      setEnv("NODE_ENV", "development");

      await hmacKey("input1");
      await hmacKey("input2");
      await hmacKey("input3");

      expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
    });

    it("should emit the missing-pepper warning on a fresh module before reset helpers run", async () => {
      vi.resetModules();
      mockLoggerWarn.mockClear();
      process.env = { ...originalEnv };
      setEnv("RATE_LIMIT_PEPPER", undefined);
      setEnv("NODE_ENV", "development");

      const freshModule = await import("../rate-limit-key-strategies");
      await freshModule.hmacKey("fresh-module-input");

      expect(mockLoggerWarn).toHaveBeenCalledWith(
        "[Rate Limit] RATE_LIMIT_PEPPER not configured. Using default development pepper. This is insecure - set RATE_LIMIT_PEPPER for production.",
      );
      freshModule.resetPepperWarning();
    });

    it("should throw error in production without pepper", async () => {
      setEnv("NODE_ENV", "production");

      await expect(hmacKey("test-input")).rejects.toThrow(
        /RATE_LIMIT_PEPPER is required in production/,
      );
    });

    it("should throw error in production with short pepper", async () => {
      setEnv("NODE_ENV", "production");
      setEnv("RATE_LIMIT_PEPPER", "tooshort");

      await expect(hmacKey("test-input")).rejects.toThrow(
        /RATE_LIMIT_PEPPER is too short/,
      );
    });

    it("should warn about weak pepper in development", async () => {
      setEnv("NODE_ENV", "development");
      setEnv("RATE_LIMIT_PEPPER", "short");

      await hmacKey("test-input");

      expect(mockLoggerWarn).toHaveBeenCalledWith(
        "[Rate Limit] RATE_LIMIT_PEPPER is weak (5 chars). Recommend at least 32 chars for production.",
      );
    });

    it("should not warn when pepper length is exactly the minimum", async () => {
      setEnv("NODE_ENV", "development");
      setEnv("RATE_LIMIT_PEPPER", "a".repeat(32));

      await hmacKey("test-input");

      expect(mockLoggerWarn).not.toHaveBeenCalled();
    });

    it("should warn only once about a weak pepper until reset", async () => {
      setEnv("NODE_ENV", "development");
      setEnv("RATE_LIMIT_PEPPER", "short");

      await hmacKey("input1");
      await hmacKey("input2");

      expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
    });

    it("should include the exact missing-pepper guidance in production errors", async () => {
      setEnv("NODE_ENV", "production");

      await expect(hmacKey("test-input")).rejects.toThrow(
        `[SECURITY] RATE_LIMIT_PEPPER is required in production. Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
      );
    });

    it("should include the exact weak-pepper guidance in production errors", async () => {
      setEnv("NODE_ENV", "production");
      setEnv("RATE_LIMIT_PEPPER", "tooshort");

      await expect(hmacKey("test-input")).rejects.toThrow(
        `[SECURITY] RATE_LIMIT_PEPPER is too short (8 chars). Minimum 32 chars required. Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
      );
    });
  });

  describe("getIPKey", () => {
    it("should return IP-based key with prefix", async () => {
      setEnv("RATE_LIMIT_PEPPER", "a".repeat(32));
      mockGetClientIP.mockReturnValue("192.168.1.100");

      const request = createMockRequest();
      const key = await getIPKey(request);

      expect(key).toMatch(/^ip:[0-9a-f]{16}$/);
    });

    it("should call getClientIP with request", async () => {
      setEnv("RATE_LIMIT_PEPPER", "a".repeat(32));
      mockGetClientIP.mockReturnValue("10.0.0.1");

      const request = createMockRequest();
      await getIPKey(request);

      expect(mockGetClientIP).toHaveBeenCalledWith(request);
    });

    it("should produce different keys for different IPs", async () => {
      setEnv("RATE_LIMIT_PEPPER", "a".repeat(32));

      mockGetClientIP.mockReturnValue("192.168.1.1");
      const key1 = await getIPKey(createMockRequest());

      mockGetClientIP.mockReturnValue("192.168.1.2");
      const key2 = await getIPKey(createMockRequest());

      expect(key1).not.toBe(key2);
    });

    it("should keep IPv4 keys based on the full IPv4 address", async () => {
      setEnv("RATE_LIMIT_PEPPER", "a".repeat(32));
      mockGetClientIP.mockReturnValue("203.0.113.50");

      const key = await getIPKey(createMockRequest());
      const expected = `ip:${await hmacKey("203.0.113.50")}`;

      expect(key).toBe(expected);
    });

    it("should bucket IPv6 addresses in the same /64 to the same key", async () => {
      setEnv("RATE_LIMIT_PEPPER", "a".repeat(32));

      mockGetClientIP.mockReturnValue("2001:db8:1234:5678:aaaa:bbbb:cccc:0001");
      const expandedKey = await getIPKey(createMockRequest());

      mockGetClientIP.mockReturnValue("2001:db8:1234:5678:ffff:eeee:dddd:9999");
      const alternateHostKey = await getIPKey(createMockRequest());

      mockGetClientIP.mockReturnValue("2001:db8:1234:5678::1");
      const compressedKey = await getIPKey(createMockRequest());

      expect(alternateHostKey).toBe(expandedKey);
      expect(compressedKey).toBe(expandedKey);
    });

    it("should bucket different IPv6 /64 prefixes to different keys", async () => {
      setEnv("RATE_LIMIT_PEPPER", "a".repeat(32));

      mockGetClientIP.mockReturnValue("2001:db8:1234:5678::1");
      const firstPrefixKey = await getIPKey(createMockRequest());

      mockGetClientIP.mockReturnValue("2001:db8:1234:5679::1");
      const secondPrefixKey = await getIPKey(createMockRequest());

      expect(firstPrefixKey).not.toBe(secondPrefixKey);
    });

    it("should keep distinct IPv4-mapped clients in separate buckets", async () => {
      setEnv("RATE_LIMIT_PEPPER", "a".repeat(32));

      mockGetClientIP.mockReturnValue("::ffff:192.0.2.128");
      const mappedKey = await getIPKey(createMockRequest());

      mockGetClientIP.mockReturnValue("::ffff:192.0.2.129");
      const mappedNeighborKey = await getIPKey(createMockRequest());

      expect(mappedNeighborKey).not.toBe(mappedKey);
    });

    it("should normalize equivalent IPv4-mapped IPv6 forms to the same key", async () => {
      setEnv("RATE_LIMIT_PEPPER", "a".repeat(32));

      mockGetClientIP.mockReturnValue("::ffff:192.0.2.128");
      const compressedMappedKey = await getIPKey(createMockRequest());

      mockGetClientIP.mockReturnValue("0:0:0:0:0:ffff:192.0.2.128");
      const expandedMappedKey = await getIPKey(createMockRequest());

      mockGetClientIP.mockReturnValue("192.0.2.128");
      const nativeIpv4Key = await getIPKey(createMockRequest());

      expect(expandedMappedKey).toBe(compressedMappedKey);
      expect(nativeIpv4Key).toBe(compressedMappedKey);
    });

    it("should fall back to the raw IP when parsing fails", async () => {
      setEnv("RATE_LIMIT_PEPPER", "a".repeat(32));
      mockGetClientIP.mockReturnValue("not-an-ip");

      const key = await getIPKey(createMockRequest());
      const expected = `ip:${await hmacKey("not-an-ip")}`;

      expect(key).toBe(expected);
    });
  });

  describe("resetPepperWarning", () => {
    it("should allow warning to be logged again after reset", async () => {
      setEnv("NODE_ENV", "development");

      await hmacKey("input1");
      expect(mockLoggerWarn).toHaveBeenCalledTimes(1);

      resetPepperWarning();
      await hmacKey("input2");
      expect(mockLoggerWarn).toHaveBeenCalledTimes(2);
    });
  });
});
