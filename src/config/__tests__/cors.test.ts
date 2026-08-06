import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock turnstile-config before importing cors module
const mockGetAllowedTurnstileHosts = vi.fn(() => ["example.com", "localhost"]);

vi.mock("@/lib/security/turnstile-config", () => ({
  getAllowedTurnstileHosts: mockGetAllowedTurnstileHosts,
}));

vi.mock("@/lib/env", () => {
  const env = {
    NEXT_PUBLIC_BASE_URL: "https://example.com",
  };

  return {
    env,
    runtimeEnv: env,
    getRuntimeEnvString: (key: string) => {
      if (key === "CORS_ALLOWED_ORIGINS") {
        return process.env.CORS_ALLOWED_ORIGINS;
      }

      if (key === "NEXT_PUBLIC_BASE_URL") {
        return process.env.NEXT_PUBLIC_BASE_URL ?? "https://example.com";
      }

      return process.env[key];
    },
  };
});

describe("CORS Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.CORS_ALLOWED_ORIGINS;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("getAllowedCorsOrigins", () => {
    it("should use CORS_ALLOWED_ORIGINS env var when set", async () => {
      process.env.CORS_ALLOWED_ORIGINS =
        "https://custom1.com,https://custom2.com";
      vi.resetModules();

      const { getAllowedCorsOrigins } = await import("../cors");
      const origins = getAllowedCorsOrigins();

      expect(origins).toContain("https://custom1.com");
      expect(origins).toContain("https://custom2.com");
    });

    it("should derive origins from Turnstile hosts when env not set", async () => {
      vi.resetModules();
      mockGetAllowedTurnstileHosts.mockReturnValue([
        "example.com",
        "localhost",
      ]);

      const { getAllowedCorsOrigins } = await import("../cors");
      const origins = getAllowedCorsOrigins();

      expect(origins).toContain("https://example.com");
      expect(origins).toContain("http://localhost:3000");
    });

    it("should trim and lowercase origins from env", async () => {
      process.env.CORS_ALLOWED_ORIGINS =
        " HTTPS://Example.COM , https://Other.com ";
      vi.resetModules();

      const { getAllowedCorsOrigins } = await import("../cors");
      const origins = getAllowedCorsOrigins();

      expect(origins).toContain("https://example.com");
      expect(origins).toContain("https://other.com");
    });

    it("should filter empty strings from env", async () => {
      process.env.CORS_ALLOWED_ORIGINS = "https://valid.com,,, ,";
      vi.resetModules();

      const { getAllowedCorsOrigins } = await import("../cors");
      const origins = getAllowedCorsOrigins();

      expect(origins).toEqual(["https://valid.com"]);
    });
  });

  describe("isAllowedOrigin", () => {
    it("should return false for null origin", async () => {
      vi.resetModules();
      const { isAllowedOrigin } = await import("../cors");

      expect(isAllowedOrigin(null)).toBe(false);
    });

    it("should return true for allowed origin", async () => {
      process.env.CORS_ALLOWED_ORIGINS = "https://allowed.com";
      vi.resetModules();

      const { isAllowedOrigin } = await import("../cors");

      expect(isAllowedOrigin("https://allowed.com")).toBe(true);
    });

    it("should return false for disallowed origin", async () => {
      process.env.CORS_ALLOWED_ORIGINS = "https://allowed.com";
      vi.resetModules();

      const { isAllowedOrigin } = await import("../cors");

      expect(isAllowedOrigin("https://evil.com")).toBe(false);
    });

    it("should be case-insensitive", async () => {
      process.env.CORS_ALLOWED_ORIGINS = "https://allowed.com";
      vi.resetModules();

      const { isAllowedOrigin } = await import("../cors");

      expect(isAllowedOrigin("HTTPS://ALLOWED.COM")).toBe(true);
    });
  });

  describe("isSameOrigin", () => {
    it("should return true when origin is null (same-origin request)", async () => {
      vi.resetModules();
      const { isSameOrigin } = await import("../cors");

      expect(isSameOrigin(null, "example.com")).toBe(true);
    });

    it("should return false when host is null", async () => {
      vi.resetModules();
      const { isSameOrigin } = await import("../cors");

      expect(isSameOrigin("https://example.com", null)).toBe(false);
    });

    it("should return true when origin hostname matches host", async () => {
      vi.resetModules();
      const { isSameOrigin } = await import("../cors");

      expect(isSameOrigin("https://example.com", "example.com")).toBe(true);
    });

    it("should return true when host includes port", async () => {
      vi.resetModules();
      const { isSameOrigin } = await import("../cors");

      expect(isSameOrigin("https://example.com", "example.com:3000")).toBe(
        true,
      );
    });

    it("should return false when hostnames differ", async () => {
      vi.resetModules();
      const { isSameOrigin } = await import("../cors");

      expect(isSameOrigin("https://other.com", "example.com")).toBe(false);
    });

    it("should return false for invalid origin URL", async () => {
      vi.resetModules();
      const { isSameOrigin } = await import("../cors");

      expect(isSameOrigin("not-a-url", "example.com")).toBe(false);
    });
  });

  describe("CORS_CONFIG", () => {
    it("should have expected default methods", async () => {
      vi.resetModules();
      const { CORS_CONFIG } = await import("../cors");

      expect(CORS_CONFIG.allowedMethods).toContain("POST");
      expect(CORS_CONFIG.allowedMethods).toContain("OPTIONS");
    });

    it("should have expected default headers", async () => {
      vi.resetModules();
      const { CORS_CONFIG } = await import("../cors");

      expect(CORS_CONFIG.allowedHeaders).toContain("Content-Type");
      expect(CORS_CONFIG.allowedHeaders).toEqual(["Content-Type"]);
    });

    it("should have maxAge set", async () => {
      vi.resetModules();
      const { CORS_CONFIG } = await import("../cors");

      expect(CORS_CONFIG.maxAge).toBeGreaterThan(0);
    });
  });
});
