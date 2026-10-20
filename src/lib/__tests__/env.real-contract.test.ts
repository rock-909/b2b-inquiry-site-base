import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sharedEnvMock from "@/lib/env";
import { captureExpectedConsoleErrors } from "@/test/console";

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
  vi.unstubAllEnvs();
});

describe("real env contract", () => {
  it("keeps the shared env mock export surface equal to the real module", async () => {
    const mocked = await vi.importMock<typeof import("@/lib/env")>("@/lib/env");
    const actual = await importActualEnv();

    expect(Object.keys(mocked).sort()).toEqual(Object.keys(actual).sort());
  });

  it("reads strings the same way in the shared env mock and the real module", async () => {
    const actual = await importActualEnv();
    vi.stubEnv("RESEND_API_KEY", "process-env-key");

    expect(actual.getRuntimeEnvString("RESEND_API_KEY")).toBe(
      "process-env-key",
    );
    expect(sharedEnvMock.getRuntimeEnvString("RESEND_API_KEY")).toBe(
      "process-env-key",
    );
  });

  it("treats a runtime value that fails its schema as unset", async () => {
    const actual = await importActualEnv();
    vi.stubEnv("EMAIL_FROM", "not-an-email");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "not-a-url");
    vi.stubEnv("DEPLOYMENT_PLATFORM", "self-hosted");

    expect(actual.getRuntimeEnvString("EMAIL_FROM")).toBeUndefined();
    expect(
      actual.getRuntimeEnvString("UPSTASH_REDIS_REST_URL"),
    ).toBeUndefined();
    expect(actual.getRuntimeEnvString("DEPLOYMENT_PLATFORM")).toBeUndefined();
  });

  it("treats an empty runtime value as unset", async () => {
    const actual = await importActualEnv();
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");

    expect(actual.getRuntimeEnvString("TURNSTILE_SECRET_KEY")).toBeUndefined();
  });

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

  it.each([
    { key: "EMAIL_FROM", value: "sales@acme.test" },
    { key: "EMAIL_FROM", value: "Acme Sales <sales@acme.test>" },
    { key: "EMAIL_FROM", value: '"Acme, Inc." <sales@acme.test>' },
    { key: "EMAIL_FROM", value: "Acmé 销售 <sales@acme.test>" },
    { key: "LOG_LEVEL", value: "info" },
    { key: "LOG_LEVEL", value: "INFO" },
  ])("loads with $key=$value", async ({ key, value }) => {
    vi.stubEnv(key, value);

    await expect(importActualEnv()).resolves.toHaveProperty("env");
  });

  it.each([
    { key: "EMAIL_FROM", value: "Acme Sales" },
    { key: "EMAIL_FROM", value: "<sales@acme.test>" },
    { key: "EMAIL_FROM", value: "Acme Sales <not-an-email>" },
    {
      key: "EMAIL_FROM",
      value: "Acme\r\nBcc: other@acme.test\r\n <sales@acme.test>",
    },
    { key: "EMAIL_FROM", value: "Acme\u0000Sales <sales@acme.test>" },
    { key: "EMAIL_FROM", value: "Acme\tSales <sales@acme.test>" },
    { key: "INQUIRY_RECIPIENT_EMAIL", value: "Owner <owner@acme.test>" },
    { key: "LOG_LEVEL", value: "verbose" },
    { key: "UPSTASH_REDIS_REST_URL", value: "not-a-url" },
  ])("rejects $key=$value at load", async ({ key, value }) => {
    const consoleError = captureExpectedConsoleErrors(
      "❌ Invalid environment variables:",
    );
    vi.stubEnv(key, value);

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
});
