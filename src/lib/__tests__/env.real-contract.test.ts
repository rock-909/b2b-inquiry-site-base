import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sharedEnvMock from "@/lib/env";
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
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("APP_ENV", "local");
  vi.stubEnv("SKIP_ENV_VALIDATION", "false");
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.test");
  vi.stubEnv("EMAIL_FROM", "sales@example.test");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  vi.stubEnv("TURNSTILE_BYPASS", "false");
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

  it.each([
    {
      scenario: "process.env value",
      processValue: "process-env-key",
      binding: undefined,
      expected: "process-env-key",
    },
    {
      scenario: "Cloudflare binding over process.env",
      processValue: "process-env-key",
      binding: "cloudflare-binding-key",
      expected: "cloudflare-binding-key",
    },
    {
      scenario: "Cloudflare binding without process.env",
      processValue: undefined,
      binding: "cloudflare-binding-key",
      expected: "cloudflare-binding-key",
    },
  ])(
    "reads strings the same way in the shared env mock and the real module: $scenario",
    async ({ processValue, binding, expected }) => {
      const actual = await importActualEnv();
      vi.stubEnv("RESEND_API_KEY", processValue);
      if (binding !== undefined) {
        (globalThis as typeof globalThis & Record<symbol, unknown>)[
          cloudflareContextSymbol
        ] = { env: { RESEND_API_KEY: binding } };
      }

      expect(actual.getRuntimeEnvString("RESEND_API_KEY")).toBe(expected);
      expect(sharedEnvMock.getRuntimeEnvString("RESEND_API_KEY")).toBe(
        expected,
      );
    },
  );

  it.each([
    { key: "TURNSTILE_BYPASS", value: "true", expected: true },
    { key: "TURNSTILE_BYPASS", value: "false", expected: false },
    { key: "TURNSTILE_BYPASS", value: "yes", expected: false },
  ])(
    "reads $key=$value as a boolean the same way in the shared env mock and the real module",
    async ({ key, value, expected }) => {
      const actual = await importActualEnv();
      vi.stubEnv(key, value);

      expect(actual.getRuntimeEnvBoolean(key as "TURNSTILE_BYPASS")).toBe(
        expected,
      );
      expect(
        sharedEnvMock.getRuntimeEnvBoolean(key as "TURNSTILE_BYPASS"),
      ).toBe(expected);
    },
  );

  it.each([
    { nodeEnv: "development", development: true, production: false },
    { nodeEnv: "production", development: false, production: true },
    { nodeEnv: "test", development: false, production: false },
  ])(
    "classifies NODE_ENV=$nodeEnv the same way in the shared env mock and the real module",
    async ({ nodeEnv, development, production }) => {
      const actual = await importActualEnv();
      vi.stubEnv("NODE_ENV", nodeEnv);

      expect([
        actual.isRuntimeDevelopment(),
        actual.isRuntimeProduction(),
      ]).toEqual([development, production]);
      expect([
        sharedEnvMock.isRuntimeDevelopment(),
        sharedEnvMock.isRuntimeProduction(),
      ]).toEqual([development, production]);
    },
  );

  it.each([
    { appEnv: "preview", expected: "preview" },
    { appEnv: "staging", expected: undefined },
  ])(
    "coerces APP_ENV=$appEnv the same way in the shared env mock and the real module",
    async ({ appEnv, expected }) => {
      const actual = await importActualEnv();
      vi.stubEnv("APP_ENV", appEnv);

      expect(actual.getRuntimeAppEnv()).toBe(expected);
      expect(sharedEnvMock.getRuntimeAppEnv()).toBe(expected);
    },
  );

  it("parses real string and boolean values", async () => {
    vi.stubEnv("TURNSTILE_BYPASS", "true");
    vi.stubEnv("SECURITY_HEADERS_ENABLED", "false");

    const { env } = await importActualEnv();

    expect(env.NEXT_PUBLIC_BASE_URL).toBe("https://example.test");
    expect(env.TURNSTILE_BYPASS).toBe(true);
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

  it.each(["DEPLOYMENT_PLATFORM", "NEXT_PUBLIC_DEPLOYMENT_PLATFORM"])(
    "rejects %s=self-hosted, a platform no code path implements",
    async (key) => {
      const consoleError = captureExpectedConsoleErrors(
        "❌ Invalid environment variables:",
      );
      vi.stubEnv(key, "self-hosted");

      try {
        await expect(importActualEnv()).rejects.toThrow(
          "Invalid environment variables",
        );
        expect(consoleError).toHaveBeenCalledTimes(1);
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );

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

  it("reads process.env changes after schema initialization", async () => {
    const actual = await importActualEnv();
    vi.stubEnv("NODE_ENV", "development");

    expect(actual.getRuntimeEnvString("NODE_ENV")).toBe("development");
    expect(actual.isRuntimeDevelopment()).toBe(true);
    expect(actual.isRuntimeProduction()).toBe(false);

    vi.stubEnv("NODE_ENV", "production");
    expect(actual.isRuntimeDevelopment()).toBe(false);
    expect(actual.isRuntimeProduction()).toBe(true);
  });

  it("reads boolean changes after schema initialization", async () => {
    const actual = await importActualEnv();
    vi.stubEnv("TURNSTILE_BYPASS", "true");
    expect(actual.getRuntimeEnvBoolean("TURNSTILE_BYPASS")).toBe(true);

    vi.stubEnv("TURNSTILE_BYPASS", "false");
    expect(actual.getRuntimeEnvBoolean("TURNSTILE_BYPASS")).toBe(false);
  });

  it("recognizes the runtime app env and rejects unknown values", async () => {
    const actual = await importActualEnv();
    vi.stubEnv("APP_ENV", "preview");
    expect(actual.getRuntimeAppEnv()).toBe("preview");

    vi.stubEnv("APP_ENV", "staging");
    expect(actual.getRuntimeAppEnv()).toBeUndefined();
  });
});
