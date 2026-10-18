import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMiddlewareMock, intlMiddlewareMock } = vi.hoisted(() => ({
  createMiddlewareMock: vi.fn(),
  intlMiddlewareMock: vi.fn(),
}));

vi.mock("next-intl/middleware", () => ({
  default: createMiddlewareMock,
}));

vi.mock("@/i18n/routing-config", () => ({
  routing: {
    defaultLocale: "en",
    locales: ["en", "es"],
    pathnames: {
      "/": "/",
      "/privacy": "/privacy",
      "/contact": "/contact",
    },
    localeCookie: { maxAge: 60 * 60 * 24 * 365 },
  },
}));

describe("proxy next-intl boundary", () => {
  beforeEach(() => {
    vi.stubEnv(
      "PUBLIC_ASSET_PATHS",
      JSON.stringify([
        "/opengraph-image.png",
        "/.well-known/security.txt",
        "/images/real.photo.jpg",
      ]),
    );
    vi.resetModules();
    vi.clearAllMocks();
    createMiddlewareMock.mockReturnValue(intlMiddlewareMock);
    intlMiddlewareMock.mockReturnValue(NextResponse.next());
  });

  it("creates one next-intl middleware and delegates the request", async () => {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest("http://localhost:3000/en/privacy");
    const intlResponse = NextResponse.next();
    intlMiddlewareMock.mockReturnValue(intlResponse);

    const response = proxy(request);

    expect(response).toBe(intlResponse);
    expect(createMiddlewareMock).toHaveBeenCalledTimes(1);
    expect(createMiddlewareMock).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultLocale: "en",
        locales: ["en", "es"],
      }),
    );
    expect(intlMiddlewareMock).toHaveBeenCalledTimes(1);
    expect(intlMiddlewareMock).toHaveBeenCalledWith(request);
  });

  it("does not manually set NEXT_LOCALE for localized requests", async () => {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest("http://localhost:3000/en/privacy", {
      headers: {
        cookie: "NEXT_LOCALE=en",
      },
    });

    const response = proxy(request);

    expect(response.headers.get("set-cookie")).toBeNull();
    expect(intlMiddlewareMock).toHaveBeenCalledTimes(1);
  });

  it("returns the pre-rendered 404 for unsupported locale-like paths", async () => {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest(
      "http://localhost:3000/unsupported-locale/contact",
    );

    const response = proxy(request);

    expect(response.status).toBe(404);
    expect(intlMiddlewareMock).not.toHaveBeenCalled();
  });

  it("returns the pre-rendered 404 for unsupported prefixed paths", async () => {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest("http://localhost:3000/fr/products/eu");

    const response = proxy(request);

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.status).toBe(404);
    expect(intlMiddlewareMock).not.toHaveBeenCalled();
  });

  it("returns the pre-rendered 404 for an unknown route", async () => {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest("http://localhost:3000/nope");

    const response = proxy(request);

    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/en/__not-found-placeholder",
    );
    expect(intlMiddlewareMock).not.toHaveBeenCalled();
  });

  it("returns a real 404 before streaming an unknown product", async () => {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest(
      "http://localhost:3000/products/not-a-real-product",
    );

    const response = proxy(request);

    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/en/__not-found-placeholder",
    );
    expect(intlMiddlewareMock).not.toHaveBeenCalled();
  });

  it("keeps the locale prefix when rewriting an unknown prefixed route to 404", async () => {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest("http://localhost:3000/es/nope");

    const response = proxy(request);

    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/es/__not-found-placeholder",
    );
    expect(intlMiddlewareMock).not.toHaveBeenCalled();
  });

  it("keeps the locale prefix when rewriting an unknown prefixed product to 404", async () => {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest(
      "http://localhost:3000/es/products/not-a-real-product",
    );

    const response = proxy(request);

    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/es/__not-found-placeholder",
    );
    expect(intlMiddlewareMock).not.toHaveBeenCalled();
  });

  it("returns 404 for a removed catalog route", async () => {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest(
      "http://localhost:3000/products/sample-offering",
    );

    expect(proxy(request).status).toBe(404);

    expect(intlMiddlewareMock).not.toHaveBeenCalled();
  });

  it("does not clean up next-intl response headers", async () => {
    const { proxy } = await import("@/proxy");
    const intlResponse = NextResponse.next();
    intlResponse.headers.set("x-middleware-set-cookie", "next-intl-owned");
    intlMiddlewareMock.mockReturnValue(intlResponse);

    const response = proxy(new NextRequest("http://localhost:3000/en/privacy"));

    expect(response.headers.get("x-middleware-set-cookie")).toBe(
      "next-intl-owned",
    );
  });

  it("does not own request overrides, nonce, CSP, health, or security headers", async () => {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest("http://localhost:3000/en/contact", {
      headers: {
        "cf-connecting-ip": "198.51.100.77",
      },
    });

    const response = proxy(request);

    expect(response.headers.get("x-middleware-override-headers")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-nonce")).toBeNull();
    expect(response.headers.get("x-nonce")).toBeNull();
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(response.headers.get("Strict-Transport-Security")).toBeNull();
    expect(response.headers.get("x-health-status")).toBeNull();
  });

  it("preserves actual assets but not missing siblings", async () => {
    const { proxy } = await import("@/proxy");
    for (const path of [
      "/opengraph-image.png",
      "/.well-known/security.txt",
      "/images/real.photo.jpg",
    ]) {
      const response = proxy(new NextRequest(`http://localhost:3000${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    }
    expect(
      proxy(new NextRequest("http://localhost:3000/images/missing.jpg")).status,
    ).toBe(404);
    expect(intlMiddlewareMock).not.toHaveBeenCalled();
  });

  it("returns a localized 404 for a dotted unknown route", async () => {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest(
      "http://localhost:3000/es/products/sample.v2",
    );
    const response = proxy(request);
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/es/__not-found-placeholder",
    );
    expect(intlMiddlewareMock).not.toHaveBeenCalled();
  });

  it("matches missing dotted pages while preserving framework and metadata routes", async () => {
    const { config } = await import("@/proxy");
    for (const url of [
      "/random.txt",
      "/en/random.txt",
      "/es/random.txt",
      "/images/retired-asset.jpg",
      "/apiary.txt",
    ]) {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    }
    for (const url of [
      "/api/inquiry",
      "/api/health",
      "/_next/static/test.js",
      "/_next/image",
      "/robots.txt",
      "/sitemap.xml",
      "/icon.svg",
      "/security-policy.txt",
    ]) {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    }
  });
});
