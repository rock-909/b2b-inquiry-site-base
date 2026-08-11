import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(repoPath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads fixed repo-local files
  return readFileSync(repoPath, "utf8");
}

describe("proxy responsibility boundary", () => {
  it("keeps CSP and generic security headers out of proxy", () => {
    const proxySource = read("src/proxy.ts");

    expect(proxySource).not.toContain("@/config/security");
    expect(proxySource).not.toContain("generateNonce");
    expect(proxySource).not.toContain("getSecurityHeaders");
    expect(proxySource).not.toContain("Content-Security-Policy");
    expect(proxySource).not.toContain("x-nonce");
  });

  it("keeps Next.js native headers as the security-header owner", () => {
    const nextConfigSource = read("next.config.ts");

    expect(nextConfigSource).toContain(
      "const securityHeaders = getSecurityHeaders();",
    );
    expect(nextConfigSource).toContain("headers: securityHeaders");
    expect(nextConfigSource).not.toContain("headersNoCSP");
    expect(nextConfigSource).not.toContain(
      "Content-Security-Policy-Report-Only",
    );
  });

  it("removes nonce helpers from the active security config API", () => {
    const securitySource = read("src/config/security.ts");

    expect(securitySource).not.toContain("export function generateNonce");
    expect(securitySource).not.toContain("export function isValidNonce");
  });

  it("keeps retired custom locale patch routing narrow", () => {
    const proxySource = read("src/proxy.ts");
    const headerClientSource = read("src/components/layout/header-client.tsx");

    expect(proxySource).toContain("isRetiredLocalePath");
    expect(proxySource).not.toContain("fromLocaleFallback");
    expect(proxySource).not.toContain("getRoutingPathPatterns");
    expect(proxySource).not.toContain("matchesRoutePattern");
    expect(proxySource).not.toContain("isKnownLocalizedPath");
    expect(proxySource).not.toContain("tryHandleInvalidLocalePrefix");
    expect(headerClientSource).not.toContain("fromLocaleFallback");
  });

  it("keeps manual locale cookie handling out of proxy", () => {
    const proxySource = read("src/proxy.ts");

    expect(proxySource).not.toContain('cookies.set("NEXT_LOCALE"');
    expect(proxySource).not.toContain("x-middleware-set-cookie");
    expect(proxySource).not.toContain("isSecureAppEnv");
    expect(proxySource).not.toContain("extractLocaleCandidate");
    expect(proxySource).not.toContain("setLocaleCookie");
    expect(proxySource).not.toContain("extractLocaleFromLocationHeader");
  });

  it("keeps proxy as a thin next-intl delegate with retired-locale 404s", () => {
    const proxySource = read("src/proxy.ts");

    expect(proxySource).toContain(
      'import createMiddleware from "next-intl/middleware";',
    );
    expect(proxySource).toContain(
      "const intlMiddleware = createMiddleware(routing);",
    );
    expect(proxySource).toContain("isRetiredLocalePath(pathname)");
    expect(proxySource).toContain("return createPlainNotFound();");
    expect(proxySource).toContain("return intlMiddleware(request);");
  });
});
