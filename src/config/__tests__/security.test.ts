import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCSP, getSecurityHeaders } from "../security";

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/** CSP 解析成 指令 -> 来源列表，断言落在具体指令上，而不是整条字符串。 */
function parseCsp(csp: string): Map<string, string[]> {
  return new Map(
    csp
      .split(";")
      .map((directive) => directive.trim().split(/\s+/u))
      .map(([name, ...sources]) => [name!, sources] as const),
  );
}

describe("Security Configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SECURITY_HEADERS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_SECURITY_MODE", "strict");
  });

  describe("generateCSP", () => {
    it("allows inline and eval scripts only in development", () => {
      vi.stubEnv("NODE_ENV", "development");
      const dev = parseCsp(generateCSP());
      expect(dev.get("script-src")).toEqual(
        expect.arrayContaining(["'unsafe-inline'", "'unsafe-eval'"]),
      );

      vi.stubEnv("NODE_ENV", "production");
      const prod = parseCsp(generateCSP());
      expect(prod.get("script-src")).not.toContain("'unsafe-inline'");
      expect(prod.get("script-src")).not.toContain("'unsafe-eval'");
      expect(prod.get("script-src-elem")).not.toContain("'unsafe-eval'");
    });

    it("should generate strict CSP in production", () => {
      vi.stubEnv("NODE_ENV", "production");

      const csp = generateCSP();
      const directives = parseCsp(csp);
      expect(directives.get("default-src")).toEqual(["'self'"]);
      expect(directives.get("script-src")).toContain("'self'");
      // Static App Router/RSC emits inline bootstrap script elements. Without
      // nonce/proxy dynamic rendering, production must allow those elements.
      expect(directives.get("script-src-elem")).toContain("'unsafe-inline'");
      // Keep inline event handlers blocked even though inline script elements
      // are allowed for Next's static bootstrap payload.
      expect(directives.get("script-src-attr")).toEqual(["'none'"]);
      // App Router/RSC inline script content changes whenever streamed payloads
      // change. This static CSP mode relies on neither hashes nor nonces.
      expect(csp).not.toContain("'sha256-");
      expect(csp).not.toContain("'nonce-");
      expect(directives.get("upgrade-insecure-requests")).toEqual([]);
    });

    // Turnstile 的脚本和 iframe 都来自这个主机；frame-src 缺了它，生产表单的
    // 人机验证 iframe 会被 CSP 拦下，询盘无法提交。
    it.each(["development", "production"])(
      "allows Cloudflare Turnstile script and iframe in %s",
      (nodeEnv) => {
        vi.stubEnv("NODE_ENV", nodeEnv);
        const directives = parseCsp(generateCSP());

        for (const directive of [
          "script-src",
          "script-src-elem",
          "frame-src",
        ]) {
          expect(directives.get(directive)).toContain(TURNSTILE_ORIGIN);
        }
      },
    );

    it("allows Google Analytics to load and report", () => {
      const directives = parseCsp(generateCSP());

      expect(directives.get("script-src")).toContain(
        "https://www.googletagmanager.com",
      );
      expect(directives.get("connect-src")).toContain(
        "https://www.google-analytics.com",
      );
    });

    it("does not allow remote font or stylesheet hosts (system font stack only)", () => {
      const directives = parseCsp(generateCSP());

      expect(directives.get("font-src")).toEqual(["'self'", "data:"]);
      expect(directives.get("style-src")).toEqual([
        "'self'",
        "'unsafe-inline'",
      ]);
      expect(directives.get("style-src-elem")).toEqual([
        "'self'",
        "'unsafe-inline'",
      ]);
    });

    // 精确 allowlist 才是安全契约：新增任何图片或上报主机都必须改这里。
    it("allows only the reviewed image and connect hosts in production CSP", () => {
      vi.stubEnv("NODE_ENV", "production");
      const directives = parseCsp(generateCSP());

      expect(directives.get("img-src")).toEqual([
        "'self'",
        "data:",
        "https://www.google-analytics.com",
        "https://www.googletagmanager.com",
      ]);
      expect(directives.get("connect-src")).toEqual([
        "'self'",
        "https://www.google-analytics.com",
        "https://analytics.google.com",
        "https://region1.google-analytics.com",
      ]);
    });

    it("does not broadly allow remote images in browser CSP", () => {
      const imgSrc = parseCsp(generateCSP()).get("img-src");

      expect(imgSrc).toBeDefined();
      expect(imgSrc).not.toContain("https:");
      expect(imgSrc).not.toContain("*");
    });

    it("should set frame-ancestors to none", () => {
      expect(parseCsp(generateCSP()).get("frame-ancestors")).toEqual([
        "'none'",
      ]);
    });
  });

  describe("getSecurityHeaders", () => {
    it("should return security headers when enabled", () => {
      vi.stubEnv("SECURITY_HEADERS_ENABLED", "true");

      const headerKeys = getSecurityHeaders().map((h) => h.key);
      expect(headerKeys).toContain("X-Frame-Options");
      expect(headerKeys).toContain("X-Content-Type-Options");
      expect(headerKeys).toContain("Referrer-Policy");
      expect(headerKeys).toContain("Strict-Transport-Security");
      expect(headerKeys).toContain("Content-Security-Policy");
      expect(headerKeys).toContain("Permissions-Policy");
    });

    it("should return empty array when disabled", () => {
      vi.stubEnv("SECURITY_HEADERS_ENABLED", "false");

      const headers = getSecurityHeaders();
      expect(headers).toHaveLength(0);
    });

    it("keeps enforced security headers in production despite unsafe env values", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("APP_ENV", "production");
      vi.stubEnv("SECURITY_HEADERS_ENABLED", "false");
      vi.stubEnv("NEXT_PUBLIC_SECURITY_MODE", "relaxed");

      const headerKeys = getSecurityHeaders().map((header) => header.key);

      expect(headerKeys).toContain("Content-Security-Policy");
      expect(headerKeys).not.toContain("Content-Security-Policy-Report-Only");
    });

    it("fails closed when APP_ENV is unavailable in a production build", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("APP_ENV", "");
      vi.stubEnv("SECURITY_HEADERS_ENABLED", "false");
      vi.stubEnv("NEXT_PUBLIC_SECURITY_MODE", "relaxed");

      const headerKeys = getSecurityHeaders().map((header) => header.key);

      expect(headerKeys).toContain("Content-Security-Policy");
      expect(headerKeys).not.toContain("Content-Security-Policy-Report-Only");
    });

    it("allows preview deployments to disable security headers", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("APP_ENV", "preview");
      vi.stubEnv("SECURITY_HEADERS_ENABLED", "false");

      expect(getSecurityHeaders()).toHaveLength(0);
    });

    it("allows preview deployments to use report-only CSP", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("APP_ENV", "preview");
      vi.stubEnv("NEXT_PUBLIC_SECURITY_MODE", "relaxed");

      const headerKeys = getSecurityHeaders().map((header) => header.key);

      expect(headerKeys).toContain("Content-Security-Policy-Report-Only");
      expect(headerKeys).not.toContain("Content-Security-Policy");
    });

    it("should set correct X-Frame-Options", () => {
      vi.stubEnv("SECURITY_HEADERS_ENABLED", "true");

      const headers = getSecurityHeaders();
      const frameHeader = headers.find((h) => h.key === "X-Frame-Options");
      expect(frameHeader?.value).toBe("DENY");
    });

    it("should set correct HSTS header", () => {
      vi.stubEnv("SECURITY_HEADERS_ENABLED", "true");

      const headers = getSecurityHeaders();
      const hstsHeader = headers.find(
        (h) => h.key === "Strict-Transport-Security",
      );
      expect(hstsHeader?.value).toBe(
        "max-age=63072000; includeSubDomains; preload",
      );
    });

    it("should output Content-Security-Policy in strict mode", () => {
      vi.stubEnv("SECURITY_HEADERS_ENABLED", "true");
      vi.stubEnv("NEXT_PUBLIC_SECURITY_MODE", "strict");

      const headers = getSecurityHeaders();
      const headerKeys = headers.map((h) => h.key);

      expect(headerKeys).toContain("Content-Security-Policy");
      expect(headerKeys).not.toContain("Content-Security-Policy-Report-Only");
    });

    it("should output Content-Security-Policy-Report-Only in relaxed mode", () => {
      vi.stubEnv("SECURITY_HEADERS_ENABLED", "true");
      vi.stubEnv("NEXT_PUBLIC_SECURITY_MODE", "relaxed");

      const headers = getSecurityHeaders();
      const headerKeys = headers.map((h) => h.key);

      expect(headerKeys).toContain("Content-Security-Policy-Report-Only");
      expect(headerKeys).not.toContain("Content-Security-Policy");
    });
  });
});
