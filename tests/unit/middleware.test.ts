import { readdirSync } from "node:fs";
import path from "node:path";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLocalePath } from "@/config/paths/utils";
import { routing } from "@/i18n/routing-config";

const LOCALE_APP_DIR = path.join(process.cwd(), "src/app/[locale]");

// Public URL of every page.tsx under src/app/[locale], read from the file
// system so the expectation does not come from the allowlist under test.
function listLocalePagePaths(): string[] {
  return readdirSync(LOCALE_APP_DIR, { recursive: true, encoding: "utf8" })
    .filter((file) => path.basename(file) === "page.tsx")
    .map((file) => path.dirname(file).split(path.sep))
    .filter((segments) => !segments.some((s) => s.startsWith("[...")))
    .map((segments) => {
      const dynamic = segments.find((s) => s.startsWith("["));
      if (dynamic) {
        throw new Error(
          `Dynamic segment ${dynamic}: add its match to src/middleware.ts and a case here`,
        );
      }
      const urlSegments = segments.filter(
        (s) => s !== "." && !/^\(.*\)$/u.test(s),
      );
      return `/${urlSegments.join("/")}`;
    });
}

const { createMiddlewareMock, intlMiddlewareMock } = vi.hoisted(() => ({
  createMiddlewareMock: vi.fn(),
  intlMiddlewareMock: vi.fn(),
}));

vi.mock("next-intl/middleware", () => ({
  default: createMiddlewareMock,
}));

describe("middleware next-intl boundary", () => {
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
    const { middleware } = await import("@/middleware");
    const request = new NextRequest("http://localhost:3000/en/privacy");
    const intlResponse = NextResponse.next();
    intlMiddlewareMock.mockReturnValue(intlResponse);

    const response = middleware(request);

    expect(response).toBe(intlResponse);
    expect(createMiddlewareMock).toHaveBeenCalledTimes(1);
    expect(createMiddlewareMock).toHaveBeenCalledWith(routing);
    expect(intlMiddlewareMock).toHaveBeenCalledTimes(1);
    expect(intlMiddlewareMock).toHaveBeenCalledWith(request);
  });

  it("does not manually set NEXT_LOCALE for localized requests", async () => {
    const { middleware } = await import("@/middleware");
    const request = new NextRequest("http://localhost:3000/en/privacy", {
      headers: {
        cookie: "NEXT_LOCALE=en",
      },
    });

    const response = middleware(request);

    expect(response.headers.get("set-cookie")).toBeNull();
    expect(intlMiddlewareMock).toHaveBeenCalledTimes(1);
  });

  it("returns the pre-rendered 404 for unsupported locale-like paths", async () => {
    const { middleware } = await import("@/middleware");
    const request = new NextRequest(
      "http://localhost:3000/unsupported-locale/contact",
    );

    const response = middleware(request);

    expect(response.status).toBe(404);
    expect(intlMiddlewareMock).not.toHaveBeenCalled();
  });

  it("returns the pre-rendered 404 for unsupported prefixed paths", async () => {
    const { middleware } = await import("@/middleware");
    const request = new NextRequest("http://localhost:3000/fr/products/eu");

    const response = middleware(request);

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.status).toBe(404);
    expect(intlMiddlewareMock).not.toHaveBeenCalled();
  });

  it("returns the pre-rendered 404 for an unknown route", async () => {
    const { middleware } = await import("@/middleware");
    const request = new NextRequest("http://localhost:3000/nope");

    const response = middleware(request);

    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      `http://localhost:3000/${routing.defaultLocale}/__not-found-placeholder`,
    );
    expect(intlMiddlewareMock).not.toHaveBeenCalled();
  });

  it("returns a real 404 before streaming an unknown product", async () => {
    const { middleware } = await import("@/middleware");
    const request = new NextRequest(
      "http://localhost:3000/products/not-a-real-product",
    );

    const response = middleware(request);

    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      `http://localhost:3000/${routing.defaultLocale}/__not-found-placeholder`,
    );
    expect(intlMiddlewareMock).not.toHaveBeenCalled();
  });

  it("keeps the locale prefix when rewriting an unknown prefixed route to 404", async () => {
    const { middleware } = await import("@/middleware");
    const prefixedLocale = routing.locales.find(
      (locale) => locale !== routing.defaultLocale,
    );
    if (!prefixedLocale) return; // single-locale site: no prefixed routes
    const request = new NextRequest(
      `http://localhost:3000/${prefixedLocale}/nope`,
    );

    const response = middleware(request);

    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      `http://localhost:3000/${prefixedLocale}/__not-found-placeholder`,
    );
    expect(intlMiddlewareMock).not.toHaveBeenCalled();
  });

  it("lets every page under src/app/[locale] through in every locale", async () => {
    const { middleware } = await import("@/middleware");
    const pagePaths = listLocalePagePaths();
    expect(pagePaths).toContain("/");

    for (const locale of routing.locales) {
      for (const pagePath of pagePaths) {
        const url = `http://localhost:3000${getLocalePath(locale, pagePath)}`;
        const response = middleware(new NextRequest(url));
        expect({ url, status: response.status }).toEqual({ url, status: 200 });
      }
    }
    expect(intlMiddlewareMock).toHaveBeenCalledTimes(
      pagePaths.length * routing.locales.length,
    );
  });

  it("does not clean up next-intl response headers", async () => {
    const { middleware } = await import("@/middleware");
    const intlResponse = NextResponse.next();
    intlResponse.headers.set("x-middleware-set-cookie", "next-intl-owned");
    intlMiddlewareMock.mockReturnValue(intlResponse);

    const response = middleware(
      new NextRequest("http://localhost:3000/en/privacy"),
    );

    expect(response.headers.get("x-middleware-set-cookie")).toBe(
      "next-intl-owned",
    );
  });

  it("does not own request overrides, nonce, CSP, health, or security headers", async () => {
    const { middleware } = await import("@/middleware");
    const request = new NextRequest("http://localhost:3000/en/contact", {
      headers: {
        "cf-connecting-ip": "198.51.100.77",
      },
    });

    const response = middleware(request);

    expect(response.headers.get("x-middleware-override-headers")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-nonce")).toBeNull();
    expect(response.headers.get("x-nonce")).toBeNull();
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(response.headers.get("Strict-Transport-Security")).toBeNull();
    expect(response.headers.get("x-health-status")).toBeNull();
  });

  it("preserves actual assets but not missing siblings", async () => {
    const { middleware } = await import("@/middleware");
    for (const path of [
      "/opengraph-image.png",
      "/.well-known/security.txt",
      "/images/real.photo.jpg",
    ]) {
      const response = middleware(
        new NextRequest(`http://localhost:3000${path}`),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    }
    expect(
      middleware(new NextRequest("http://localhost:3000/images/missing.jpg"))
        .status,
    ).toBe(404);
    expect(intlMiddlewareMock).not.toHaveBeenCalled();
  });

  it("returns the 404 rewrite for a dotted unknown route", async () => {
    const { middleware } = await import("@/middleware");
    const request = new NextRequest("http://localhost:3000/products/sample.v2");
    const response = middleware(request);
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      `http://localhost:3000/${routing.defaultLocale}/__not-found-placeholder`,
    );
    expect(intlMiddlewareMock).not.toHaveBeenCalled();
  });

  it("matches missing dotted pages while preserving framework and metadata routes", async () => {
    const { config } = await import("@/middleware");
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
