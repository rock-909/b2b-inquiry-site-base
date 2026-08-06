import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCSP, getSecurityHeaders } from "../security";

describe("Security Configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SECURITY_HEADERS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_SECURITY_MODE", "strict");
  });

  describe("generateCSP", () => {
    it("should generate basic CSP in development", () => {
      vi.stubEnv("NODE_ENV", "development");

      const csp = generateCSP();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("'unsafe-inline'");
      expect(csp).toContain("'unsafe-eval'");
      expect(csp).toContain("https://unpkg.com");
    });

    it("should generate strict CSP in production", () => {
      vi.stubEnv("NODE_ENV", "production");

      const csp = generateCSP();
      expect(csp).toContain("default-src 'self'");
      // style-src allows 'unsafe-inline' for Tailwind CSS compatibility
      expect(csp).toMatch(/style-src[^;]*'unsafe-inline'/);
      expect(csp).toMatch(/style-src-elem[^;]*'unsafe-inline'/);
      // script-src should NOT contain unsafe-inline in production
      expect(csp).not.toMatch(/script-src(?!-elem)[^;]*'unsafe-inline'/);
      // Static App Router/RSC emits inline bootstrap script elements. Without
      // nonce/proxy dynamic rendering, production must allow those elements.
      expect(csp).toMatch(/script-src-elem[^;]*'unsafe-inline'/);
      // Keep inline event handlers blocked even though inline script elements
      // are allowed for Next's static bootstrap payload.
      expect(csp).toContain("script-src-attr 'none'");
      // App Router/RSC inline script content changes whenever streamed payloads
      // change. This static CSP mode does not rely on content hashes.
      expect(csp).not.toContain("'sha256-");
      expect(csp).not.toContain("'unsafe-eval'");
      expect(csp).toContain("upgrade-insecure-requests");
    });

    it("should generate static CSP without nonce directives", () => {
      vi.stubEnv("NODE_ENV", "production");

      const csp = generateCSP();
      expect(csp).not.toContain("'nonce-");
      expect(csp).toMatch(/script-src(?!-elem)[^;]*'self'/);
    });

    it("should include required external domains", () => {
      const csp = generateCSP();
      expect(csp).toContain("https://challenges.cloudflare.com");
      expect(csp).toContain("https://fonts.googleapis.com");
      expect(csp).toContain("https://fonts.gstatic.com");
      expect(csp).toContain("https://www.googletagmanager.com");
      expect(csp).toContain("https://www.google-analytics.com");
    });

    it("does not allow starter image hosts or server-only email APIs in browser CSP", () => {
      const csp = generateCSP();

      expect(csp).not.toContain("https://images.unsplash.com");
      expect(csp).not.toContain("https://via.placeholder.com");
      expect(csp).not.toContain("https://api.resend.com");
    });

    it("does not broadly allow remote images in browser CSP", () => {
      const csp = generateCSP();
      const imgSrc = csp
        .split(";")
        .find((directive) => directive.trim().startsWith("img-src"));

      expect(imgSrc).toBeDefined();
      expect(imgSrc).not.toMatch(/(^|\s)https:(\s|$)/u);
    });

    it("should set frame-ancestors to none", () => {
      const csp = generateCSP();
      expect(csp).toContain("frame-ancestors 'none'");
    });
  });

  describe("getSecurityHeaders", () => {
    it("should return security headers when enabled", () => {
      vi.stubEnv("SECURITY_HEADERS_ENABLED", "true");

      const headers = getSecurityHeaders();
      expect(headers).toHaveLength(10);

      const headerKeys = headers.map((h) => h.key);
      expect(headerKeys).toContain("X-Frame-Options");
      expect(headerKeys).toContain("X-Content-Type-Options");
      expect(headerKeys).toContain("Referrer-Policy");
      expect(headerKeys).toContain("Strict-Transport-Security");
      expect(headerKeys).toContain("Content-Security-Policy");
      expect(headerKeys).toContain("Permissions-Policy");
      expect(headerKeys).toContain("Reporting-Endpoints");
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

    it("should emit static CSP without nonce directives", () => {
      vi.stubEnv("SECURITY_HEADERS_ENABLED", "true");

      const headers = getSecurityHeaders();

      const cspHeader = headers.find(
        (h) => h.key === "Content-Security-Policy",
      );
      expect(cspHeader?.value).not.toContain("'nonce-");
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

    it("should include report-uri directive in CSP", () => {
      vi.stubEnv("SECURITY_HEADERS_ENABLED", "true");
      vi.stubEnv("CSP_REPORT_URI", "");

      const headers = getSecurityHeaders();
      const cspHeader = headers.find(
        (h) =>
          h.key === "Content-Security-Policy" ||
          h.key === "Content-Security-Policy-Report-Only",
      );

      expect(cspHeader?.value).toContain("report-uri /api/csp-report");
    });

    it("should allow CSP report-uri override via env", () => {
      vi.stubEnv("SECURITY_HEADERS_ENABLED", "true");
      vi.stubEnv("CSP_REPORT_URI", "https://example.com/csp-report");

      const headers = getSecurityHeaders();
      const cspHeader = headers.find(
        (h) =>
          h.key === "Content-Security-Policy" ||
          h.key === "Content-Security-Policy-Report-Only",
      );

      expect(cspHeader?.value).toContain(
        "report-uri https://example.com/csp-report",
      );
    });

    it("should include a report-to directive alongside report-uri", () => {
      vi.stubEnv("SECURITY_HEADERS_ENABLED", "true");
      vi.stubEnv("CSP_REPORT_URI", "");

      const headers = getSecurityHeaders();
      const cspHeader = headers.find(
        (h) =>
          h.key === "Content-Security-Policy" ||
          h.key === "Content-Security-Policy-Report-Only",
      );

      // Modern report-to runs in parallel with legacy report-uri.
      expect(cspHeader?.value).toContain("report-to csp-endpoint");
      expect(cspHeader?.value).toContain("report-uri /api/csp-report");
    });

    it("should emit a Reporting-Endpoints header mapping the CSP endpoint name", () => {
      vi.stubEnv("SECURITY_HEADERS_ENABLED", "true");
      vi.stubEnv("CSP_REPORT_URI", "");

      const headers = getSecurityHeaders();
      const reportingHeader = headers.find(
        (h) => h.key === "Reporting-Endpoints",
      );

      expect(reportingHeader?.value).toBe('csp-endpoint="/api/csp-report"');
    });

    it("should point the Reporting-Endpoints header at the env override", () => {
      vi.stubEnv("SECURITY_HEADERS_ENABLED", "true");
      vi.stubEnv("CSP_REPORT_URI", "https://example.com/csp-report");

      const headers = getSecurityHeaders();
      const reportingHeader = headers.find(
        (h) => h.key === "Reporting-Endpoints",
      );

      expect(reportingHeader?.value).toBe(
        'csp-endpoint="https://example.com/csp-report"',
      );
    });
  });
});
