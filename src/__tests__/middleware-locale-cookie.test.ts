import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { intlMiddlewareMock } = vi.hoisted(() => ({
  intlMiddlewareMock: vi.fn(),
}));

vi.mock("next-intl/middleware", () => ({
  default: () => intlMiddlewareMock,
}));

vi.mock("@/config/paths/locales-config", () => ({
  LOCALES_CONFIG: {
    locales: ["en"],
    defaultLocale: "en",
    localePrefix: "never",
    retiredLocales: ["zh"],
  },
}));

import middleware from "../middleware";

beforeEach(() => {
  vi.clearAllMocks();
  intlMiddlewareMock.mockImplementation(() => NextResponse.next());
});

describe("middleware locale cookie", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("CF_PAGES", "1");
  });

  it("delegates localized requests to next-intl without manually setting NEXT_LOCALE", () => {
    const request = new NextRequest("http://localhost/en/about", {
      headers: {
        cookie: "NEXT_LOCALE=zh",
      },
    });
    const intlResponse = NextResponse.next();
    intlMiddlewareMock.mockReturnValue(intlResponse);

    const response = middleware(request);

    expect(response).toBe(intlResponse);
    expect(intlMiddlewareMock).toHaveBeenCalledTimes(1);
    expect(intlMiddlewareMock).toHaveBeenCalledWith(request);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("lets unsupported locale-like prefixes fall through to next-intl", () => {
    const request = new NextRequest("http://localhost/fr/about", {
      headers: {
        cookie: "NEXT_LOCALE=zh",
      },
    });

    const response = middleware(request);

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(intlMiddlewareMock).toHaveBeenCalledTimes(1);
  });

  it("short-circuits retired Chinese locale paths without setting cookies", async () => {
    const request = new NextRequest("http://localhost/zh/about", {
      headers: {
        cookie: "NEXT_LOCALE=en",
      },
    });

    const response = middleware(request);

    expect(response.status).toBe(404);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    await expect(response.text()).resolves.toBe("Not Found");
    expect(intlMiddlewareMock).not.toHaveBeenCalled();
  });

  it("lets unsupported locale-like product routes fall through to next-intl", () => {
    const request = new NextRequest("http://localhost/fr/products/eu", {
      headers: {
        cookie: "NEXT_LOCALE=zh",
      },
    });

    const response = middleware(request);

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(intlMiddlewareMock).toHaveBeenCalledTimes(1);
  });

  it("returns next-intl responses without cleaning middleware-owned headers", () => {
    intlMiddlewareMock.mockImplementation(() => {
      const response = NextResponse.redirect("http://localhost/en");
      response.headers.set("x-middleware-set-cookie", "next-intl-owned");
      return response;
    });

    const request = new NextRequest("http://localhost/");
    const response = middleware(request);

    expect(response.headers.get("x-middleware-set-cookie")).toBe(
      "next-intl-owned",
    );
    expect(intlMiddlewareMock).toHaveBeenCalledTimes(1);
  });

  it("does not add request overrides, nonce, CSP, health, or security headers", () => {
    const request = new NextRequest("http://localhost/en/contact", {
      headers: {
        "cf-connecting-ip": "198.51.100.77",
        "x-forwarded-for": "203.0.113.9",
      },
    });

    const response = middleware(request);

    expect(response.headers.get("x-middleware-override-headers")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-nonce")).toBeNull();
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(response.headers.get("x-nonce")).toBeNull();
    expect(response.headers.get("x-health-status")).toBeNull();
  });
});
