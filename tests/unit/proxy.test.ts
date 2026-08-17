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
    locales: ["en"],
    pathnames: {
      "/": "/",
      "/about": "/about",
      "/contact": "/contact",
      "/products": "/products",
      "/request-quote": "/request-quote",
    },
    localeCookie: { maxAge: 60 * 60 * 24 * 365 },
  },
}));

vi.mock("@/config/offerings", () => ({
  getOfferingById: (id: string) =>
    id === "sample-offering" ? { id } : undefined,
}));

describe("proxy next-intl boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createMiddlewareMock.mockReturnValue(intlMiddlewareMock);
    intlMiddlewareMock.mockReturnValue(NextResponse.next());
  });

  it("creates one next-intl middleware and delegates the request", async () => {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest("http://localhost:3000/en/about");
    const intlResponse = NextResponse.next();
    intlMiddlewareMock.mockReturnValue(intlResponse);

    const response = proxy(request);

    expect(response).toBe(intlResponse);
    expect(createMiddlewareMock).toHaveBeenCalledTimes(1);
    expect(createMiddlewareMock).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultLocale: "en",
        locales: ["en"],
      }),
    );
    expect(intlMiddlewareMock).toHaveBeenCalledTimes(1);
    expect(intlMiddlewareMock).toHaveBeenCalledWith(request);
  });

  it("does not manually set NEXT_LOCALE for localized requests", async () => {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest("http://localhost:3000/en/about", {
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

  it("delegates a configured product to next-intl", async () => {
    const { proxy } = await import("@/proxy");
    const request = new NextRequest(
      "http://localhost:3000/products/sample-offering",
    );

    proxy(request);

    expect(intlMiddlewareMock).toHaveBeenCalledWith(request);
  });

  it("does not clean up next-intl response headers", async () => {
    const { proxy } = await import("@/proxy");
    const intlResponse = NextResponse.next();
    intlResponse.headers.set("x-middleware-set-cookie", "next-intl-owned");
    intlMiddlewareMock.mockReturnValue(intlResponse);

    const response = proxy(new NextRequest("http://localhost:3000/en/about"));

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

  it("keeps matcher out of api, _next, and static files only", async () => {
    const { config } = await import("@/proxy");

    expect(config.matcher).toEqual(["/", "/((?!api|_next|.*\\..*).*)"]);
    expect(config.matcher.join(" ")).not.toContain("admin");
    expect(config.matcher.join(" ")).not.toContain("ops");
  });

  it("keeps proxy as the Cloudflare runtime entrypoint", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const repoRoot = path.resolve(__dirname, "../..");

    expect(fs.existsSync(path.join(repoRoot, "src/proxy.ts"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "src/middleware.ts"))).toBe(false);
  });
});
