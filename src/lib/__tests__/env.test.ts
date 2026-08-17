import { afterEach, describe, expect, it, vi } from "vitest";
/**
 * Tests for env.ts utility functions
 *
 * Note: The env object itself is created via @t3-oss/env-nextjs at module load time
 * and is difficult to test directly. The global test setup mocks @/lib/env.
 * Here we test the exported utility functions by using the mocked env object.
 */

import {
  env,
  getRuntimeAppEnv,
  getRuntimeEnvBoolean,
  getRuntimeEnvString,
  isRuntimeDevelopment,
  isRuntimeProduction,
} from "../env";

const cloudflareContextSymbol = Symbol.for("__cloudflare-context__");

afterEach(() => {
  delete (globalThis as typeof globalThis & Record<symbol, unknown>)[
    cloudflareContextSymbol
  ];
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("APP_ENV", "local");
  vi.stubEnv("TURNSTILE_BYPASS", "false");
});

describe("env utilities", () => {
  describe("env object", () => {
    it("should export env object", () => {
      expect(env).toBeDefined();
      expect(typeof env).toBe("object");
    });

    it("should have NODE_ENV property", () => {
      expect(env.NODE_ENV).toBeDefined();
    });
  });
});

describe("env type safety", () => {
  it("should have correct server env vars defined", () => {
    // These are defined in the schema and should exist on the env object
    expect("NODE_ENV" in env).toBe(true);
    expect("TURNSTILE_SECRET_KEY" in env).toBe(true);
    expect("RESEND_API_KEY" in env).toBe(true);
  });

  it("exposes the production rate-limit contract vars through the central env object", () => {
    expect("ALLOW_MEMORY_RATE_LIMIT" in env).toBe(true);
  });

  it("exposes Cloudflare deployment account vars through the central env object", () => {
    expect("CLOUDFLARE_ACCOUNT_ID" in env).toBe(true);
  });

  it("should have correct client env vars defined", () => {
    expect("NEXT_PUBLIC_BASE_URL" in env).toBe(true);
    expect("NEXT_PUBLIC_TURNSTILE_SITE_KEY" in env).toBe(true);
  });
});

describe("runtime env helpers", () => {
  it("prefers process.env strings over validated env values", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(getRuntimeEnvString("NODE_ENV")).toBe("development");
    expect(isRuntimeDevelopment()).toBe(true);
    expect(isRuntimeProduction()).toBe(false);
  });

  it("prefers Cloudflare request context bindings over process.env", () => {
    vi.stubEnv("RESEND_API_KEY", "process-env-key");
    (globalThis as typeof globalThis & Record<symbol, unknown>)[
      cloudflareContextSymbol
    ] = {
      env: {
        RESEND_API_KEY: "cloudflare-binding-key",
      },
    };

    expect(getRuntimeEnvString("RESEND_API_KEY")).toBe(
      "cloudflare-binding-key",
    );
  });

  it("parses booleans from string env values", () => {
    vi.stubEnv("TURNSTILE_BYPASS", "true");

    expect(getRuntimeEnvBoolean("TURNSTILE_BYPASS")).toBe(true);
  });

  it("recognizes the app env", () => {
    vi.stubEnv("APP_ENV", "preview");

    expect(getRuntimeAppEnv()).toBe("preview");
  });

  it("returns undefined for unknown runtime app env", () => {
    vi.stubEnv("APP_ENV", "staging");

    expect(getRuntimeAppEnv()).toBeUndefined();
  });
});
