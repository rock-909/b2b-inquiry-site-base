import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getClientIP } from "../client-ip";

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

describe("client-ip", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    process.env = { ...originalEnv };
    setEnv("DEPLOYMENT_PLATFORM", undefined);
    setEnv("CF_PAGES", undefined);
    setEnv("NODE_ENV", undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
    process.env = originalEnv;
  });

  function createMockRequest(
    options: {
      headers?: Record<string, string>;
    } = {},
  ): NextRequest {
    const url = "http://localhost/api/test";
    const headers = new Headers(options.headers);
    return new NextRequest(url, { headers });
  }

  describe("getClientIP", () => {
    describe("no platform configured", () => {
      it("should return fallback IP when no platform is configured", () => {
        const request = createMockRequest();
        const ip = getClientIP(request);
        expect(ip).toBe("0.0.0.0");
      });

      it("should NOT trust x-forwarded-for without platform", () => {
        const request = createMockRequest({
          headers: { "x-forwarded-for": "1.2.3.4" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("0.0.0.0");
      });
    });

    describe("Cloudflare platform", () => {
      beforeEach(() => {
        setEnv("CF_PAGES", "1");
      });

      it("trusts cf-connecting-ip directly on the Cloudflare Workers platform", () => {
        setEnv("DEPLOYMENT_PLATFORM", "cloudflare");
        const request = createMockRequest({
          headers: {
            "cf-connecting-ip": "198.51.100.77",
            "x-forwarded-for": "203.0.113.10",
          },
        });

        expect(getClientIP(request)).toBe("198.51.100.77");
      });

      it("should extract IP from cf-connecting-ip header on Cloudflare Workers", () => {
        const request = createMockRequest({
          headers: { "cf-connecting-ip": "192.0.2.100" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("192.0.2.100");
      });

      it("should prefer cf-connecting-ip over x-forwarded-for on Cloudflare Workers", () => {
        const request = createMockRequest({
          headers: {
            "cf-connecting-ip": "192.0.2.100",
            "x-forwarded-for": "203.0.113.50",
          },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("192.0.2.100");
      });

      it("should fail closed when cf-connecting-ip is missing on Cloudflare Workers", () => {
        const request = createMockRequest({
          headers: {
            "x-forwarded-for": "203.0.113.50, 10.0.0.1",
          },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("0.0.0.0");
      });

      it("trusts Cloudflare headers because the Worker is the edge entrypoint", () => {
        const request = createMockRequest({
          headers: { "cf-connecting-ip": "192.0.2.100" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("192.0.2.100");
      });

      it("fails closed when cf-connecting-ip is invalid", () => {
        setEnv("DEPLOYMENT_PLATFORM", "cloudflare");
        const request = createMockRequest({
          headers: {
            "cf-connecting-ip": "not-an-ip",
            "x-forwarded-for": "198.51.100.77",
          },
        });

        expect(getClientIP(request)).toBe("0.0.0.0");
      });

      it("should trust Cloudflare IPv6 client IPs", () => {
        const request = createMockRequest({
          headers: { "cf-connecting-ip": "2001:db8::100" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("2001:db8::100");
      });
    });

    describe("development platform", () => {
      beforeEach(() => {
        setEnv("NODE_ENV", "development");
      });

      it("should trust x-forwarded-for in development", () => {
        const request = createMockRequest({
          headers: { "x-forwarded-for": "192.168.1.100" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("192.168.1.100");
      });

      it("should return localhost when no IP available", () => {
        const request = createMockRequest();
        const ip = getClientIP(request);
        expect(ip).toBe("127.0.0.1");
      });
    });

    describe("explicit DEPLOYMENT_PLATFORM", () => {
      it("should respect explicit platform over auto-detection", () => {
        setEnv("DEPLOYMENT_PLATFORM", "cloudflare");

        const request = createMockRequest({
          headers: {
            "cf-connecting-ip": "192.0.2.100",
            "x-real-ip": "198.51.100.10",
          },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("192.0.2.100");
      });

      it("should use explicit development platform without relying on NODE_ENV", () => {
        setEnv("DEPLOYMENT_PLATFORM", "development");

        const request = createMockRequest();

        expect(getClientIP(request)).toBe("127.0.0.1");
      });

      it("should not trust headers when platform is unknown", () => {
        setEnv("DEPLOYMENT_PLATFORM", "custom-edge");

        const request = createMockRequest({
          headers: { "x-real-ip": "198.51.100.10" },
        });

        expect(getClientIP(request)).toBe("0.0.0.0");
      });

      it("should return fallback IP when platform is unknown", () => {
        setEnv("DEPLOYMENT_PLATFORM", "custom-edge");

        const request = createMockRequest({
          headers: { "x-forwarded-for": "198.51.100.10" },
        });

        expect(getClientIP(request)).toBe("0.0.0.0");
      });
    });

    describe("IP validation and normalization", () => {
      beforeEach(() => {
        setEnv("NODE_ENV", "development");
      });

      it("should reject invalid IP addresses", () => {
        const request = createMockRequest({
          headers: { "x-real-ip": "not-an-ip" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("127.0.0.1");
      });

      it("should strip port from IPv4 address", () => {
        const request = createMockRequest({
          headers: { "x-real-ip": "192.168.1.100:8080" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("192.168.1.100");
      });

      it("should strip port from bracketed IPv6 address", () => {
        const request = createMockRequest({
          headers: { "x-real-ip": "[::1]:8080" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("::1");
      });

      it("should handle IPv6 without brackets", () => {
        const request = createMockRequest({
          headers: { "x-real-ip": "2001:db8::1" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("2001:db8::1");
      });

      it("should reject malformed IP with invalid octets", () => {
        const request = createMockRequest({
          headers: { "x-real-ip": "256.256.256.256" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("127.0.0.1");
      });

      it('should handle "unknown" value in header', () => {
        const request = createMockRequest({
          headers: { "x-forwarded-for": "unknown, 192.168.1.1" },
        });
        const ip = getClientIP(request);
        // First value "unknown" is invalid, should try next header or fallback
        expect(ip).not.toBe("unknown");
      });
    });

    describe("x-forwarded-for parsing", () => {
      beforeEach(() => {
        setEnv("NODE_ENV", "development");
      });

      it("should extract first IP from comma-separated list", () => {
        const request = createMockRequest({
          headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1, 172.16.0.1" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("203.0.113.1");
      });

      it("should trim whitespace from IPs", () => {
        const request = createMockRequest({
          headers: { "x-forwarded-for": "  203.0.113.50  , 10.0.0.1" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("203.0.113.50");
      });

      it("should strip port from first IP in chain", () => {
        const request = createMockRequest({
          headers: { "x-forwarded-for": "203.0.113.50:12345, 10.0.0.1" },
        });
        const ip = getClientIP(request);
        expect(ip).toBe("203.0.113.50");
      });
    });
  });

  describe("edge cases", () => {
    it("should handle empty string IP", () => {
      setEnv("NODE_ENV", "development");
      const request = createMockRequest({
        headers: { "x-forwarded-for": "" },
      });
      const ip = getClientIP(request);
      expect(ip).toBe("127.0.0.1");
    });

    it("should handle whitespace-only IP", () => {
      setEnv("NODE_ENV", "development");
      const request = createMockRequest({
        headers: { "x-forwarded-for": "   " },
      });
      const ip = getClientIP(request);
      expect(ip).toBe("127.0.0.1");
    });

    it("should handle empty x-forwarded-for list", () => {
      setEnv("NODE_ENV", "development");
      const request = createMockRequest({
        headers: { "x-forwarded-for": ",," },
      });
      const ip = getClientIP(request);
      expect(ip).toBe("127.0.0.1");
    });

    it("should reject malformed IPv6 with triple colons", () => {
      setEnv("NODE_ENV", "development");
      const request = createMockRequest({
        headers: { "x-forwarded-for": "2001:db8:::1" },
      });
      const ip = getClientIP(request);
      expect(ip).toBe("127.0.0.1");
    });

    it("should reject malformed IPv6 with trailing single colon", () => {
      setEnv("NODE_ENV", "development");
      const request = createMockRequest({
        headers: { "x-forwarded-for": "2001:db8::1:" },
      });
      const ip = getClientIP(request);
      expect(ip).toBe("127.0.0.1");
    });

    it("should reject malformed IPv6 with leading single colon", () => {
      setEnv("NODE_ENV", "development");
      const request = createMockRequest({
        headers: { "x-forwarded-for": ":1::2" },
      });
      const ip = getClientIP(request);
      expect(ip).toBe("127.0.0.1");
    });

    it("should reject IPv6 with redundant compression (zero missing segments)", () => {
      setEnv("NODE_ENV", "development");
      const request = createMockRequest({
        headers: { "x-forwarded-for": "1:2:3:4:5:6:7::8" },
      });
      const ip = getClientIP(request);
      expect(ip).toBe("127.0.0.1");
    });

    it("should accept valid compressed IPv6 forms", () => {
      setEnv("NODE_ENV", "development");
      const valid = ["::1", "::", "fe80::", "2001:db8::1", "::ffff:192.0.2.1"];
      for (const addr of valid) {
        const request = createMockRequest({
          headers: { "x-forwarded-for": addr },
        });
        const ip = getClientIP(request);
        expect(ip).toBe(addr);
      }
    });
  });
});
