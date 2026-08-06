import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureExpectedConsoleErrors } from "@/test/console";

const cloudflareContextSymbol = Symbol.for("__cloudflare-context__");

async function importActualEnv() {
  const windowDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "window",
  );
  Object.defineProperty(globalThis, "window", {
    value: undefined,
    writable: true,
    configurable: true,
  });
  vi.doUnmock("@t3-oss/env-nextjs");
  vi.resetModules();

  try {
    return await vi.importActual<typeof import("@/lib/env")>("@/lib/env");
  } finally {
    if (windowDescriptor) {
      Object.defineProperty(globalThis, "window", windowDescriptor);
    }
  }
}

beforeEach(() => {
  vi.stubEnv("SKIP_ENV_VALIDATION", "false");
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.test");
  vi.stubEnv("EMAIL_FROM", "sales@example.test");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  vi.stubEnv("TURNSTILE_BYPASS", "false");
  vi.stubEnv("PLAYWRIGHT_TEST", "false");
  vi.stubEnv("SECURITY_HEADERS_ENABLED", "true");
});

afterEach(() => {
  delete (globalThis as typeof globalThis & Record<symbol, unknown>)[
    cloudflareContextSymbol
  ];
});

describe("real env contract", () => {
  it("keeps the shared env mock export surface equal to the real module", async () => {
    const mocked = await vi.importMock<typeof import("@/lib/env")>("@/lib/env");
    const actual = await importActualEnv();

    expect(Object.keys(mocked).sort()).toEqual(Object.keys(actual).sort());
  });

  it("parses real string, boolean, and numeric values", async () => {
    vi.stubEnv("TURNSTILE_BYPASS", "true");
    vi.stubEnv("PLAYWRIGHT_TEST", "true");
    vi.stubEnv("SECURITY_HEADERS_ENABLED", "false");

    const { env } = await importActualEnv();

    expect(env.NEXT_PUBLIC_BASE_URL).toBe("https://example.test");
    expect(env.TURNSTILE_BYPASS).toBe(true);
    expect(env.PLAYWRIGHT_TEST).toBe(true);
    expect(env.SECURITY_HEADERS_ENABLED).toBe(false);
  });

  it("rejects invalid values through the real schema", async () => {
    const consoleError = captureExpectedConsoleErrors(
      "❌ Invalid environment variables:",
    );
    vi.stubEnv("EMAIL_FROM", "not-an-email");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "not-a-url");

    await expect(importActualEnv()).rejects.toThrow(
      "Invalid environment variables",
    );
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("prefers live Cloudflare bindings over process.env", async () => {
    vi.stubEnv("RESEND_API_KEY", "process-env-key");
    const actual = await importActualEnv();

    (globalThis as typeof globalThis & Record<symbol, unknown>)[
      cloudflareContextSymbol
    ] = {
      env: {
        RESEND_API_KEY: "cloudflare-binding-key",
      },
    };

    expect(actual.getRuntimeEnvString("RESEND_API_KEY")).toBe(
      "cloudflare-binding-key",
    );
  });
});
