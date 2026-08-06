import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(repoPath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads fixed repo-local files
  return readFileSync(repoPath, "utf8");
}

describe("middleware responsibility boundary", () => {
  it("keeps CSP and generic security headers out of middleware", () => {
    const middlewareSource = read("src/middleware.ts");

    expect(middlewareSource).not.toContain("@/config/security");
    expect(middlewareSource).not.toContain("generateNonce");
    expect(middlewareSource).not.toContain("getSecurityHeaders");
    expect(middlewareSource).not.toContain("Content-Security-Policy");
    expect(middlewareSource).not.toContain("x-nonce");
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
    const middlewareSource = read("src/middleware.ts");
    const headerClientSource = read("src/components/layout/header-client.tsx");

    expect(middlewareSource).toContain("isRetiredLocalePath");
    expect(middlewareSource).not.toContain("fromLocaleFallback");
    expect(middlewareSource).not.toContain("getRoutingPathPatterns");
    expect(middlewareSource).not.toContain("matchesRoutePattern");
    expect(middlewareSource).not.toContain("isKnownLocalizedPath");
    expect(middlewareSource).not.toContain("tryHandleInvalidLocalePrefix");
    expect(headerClientSource).not.toContain("fromLocaleFallback");
  });

  it("keeps manual locale cookie handling out of middleware", () => {
    const middlewareSource = read("src/middleware.ts");

    expect(middlewareSource).not.toContain('cookies.set("NEXT_LOCALE"');
    expect(middlewareSource).not.toContain("x-middleware-set-cookie");
    expect(middlewareSource).not.toContain("isSecureAppEnv");
    expect(middlewareSource).not.toContain("extractLocaleCandidate");
    expect(middlewareSource).not.toContain("setLocaleCookie");
    expect(middlewareSource).not.toContain("extractLocaleFromLocationHeader");
  });

  it("keeps middleware as a thin next-intl delegate with pre-stream finite-route 404s", () => {
    const middlewareSource = read("src/middleware.ts");

    expect(middlewareSource).toContain(
      'import createMiddleware from "next-intl/middleware";',
    );
    expect(middlewareSource).toContain(
      "const intlMiddleware = createMiddleware(routing);",
    );
    expect(middlewareSource).toContain("isRetiredLocalePath(pathname)");
    expect(middlewareSource).toContain("isUnknownProductPath(pathname)");
    expect(middlewareSource).toContain("return createPlainNotFound();");
    expect(middlewareSource).toContain("return intlMiddleware(request);");
  });
});
