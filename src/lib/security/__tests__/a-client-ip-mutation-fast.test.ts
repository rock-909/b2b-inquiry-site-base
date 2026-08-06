import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { getClientIP } from "../client-ip";

function setEnv(key: string, value: string | undefined): void {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) {
    delete env[key];
  } else {
    env[key] = value;
  }
}

function createMockRequest(
  options: {
    headers?: Record<string, string>;
  } = {},
): NextRequest {
  return new NextRequest("https://example.com/contact", {
    headers: new Headers(options.headers),
  });
}

describe("client-ip mutation fast path", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("trusts direct Cloudflare Workers client IP headers for public client IP extraction", () => {
    setEnv("CF_PAGES", "1");

    const request = createMockRequest({
      headers: { "cf-connecting-ip": "192.0.2.100" },
    });

    expect(getClientIP(request)).toBe("192.0.2.100");
  });

  it("falls back when Cloudflare Workers headers are missing", () => {
    setEnv("CF_PAGES", "1");

    const request = createMockRequest();

    expect(getClientIP(request)).toBe("0.0.0.0");
  });
});
