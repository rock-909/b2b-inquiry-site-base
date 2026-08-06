import { vi } from "vitest";

// Mock environment variables - use Object.defineProperty for read-only properties
try {
  if (!process.env.NODE_ENV) {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "test",
      writable: false,
      enumerable: true,
      configurable: true,
    });
  }
} catch {
  // Environment variable already set, ignore
}

// Mock environment variables - 使用vi.stubEnv而不是直接修改process.env
vi.stubEnv("NODE_ENV", "test");
vi.stubEnv("APP_ENV", "local");
vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.com");
vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "test-site-key-12345");
vi.stubEnv("NEXT_PUBLIC_DEPLOYMENT_PLATFORM", "development");
vi.stubEnv("NEXT_PUBLIC_TEST_MODE", "false");

// Suppress info/debug logs in tests - only warn and error are output
vi.stubEnv("LOG_LEVEL", "warn");

// Mock server-side environment variables for API testing
vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret-key");
vi.stubEnv("RESEND_API_KEY", "test-resend-key");
vi.stubEnv("AIRTABLE_API_KEY", "test-airtable-key");
vi.stubEnv("AIRTABLE_BASE_ID", "test-base-id");
vi.stubEnv("AIRTABLE_TABLE_NAME", "test-table");
vi.stubEnv("EMAIL_FROM", "test@example.com");
vi.stubEnv("EMAIL_REPLY_TO", "reply@example.com");
vi.stubEnv("CSP_REPORT_URI", "https://example.com/csp-report");
vi.stubEnv("ADMIN_API_TOKEN", "test-admin-token");
vi.stubEnv("TURNSTILE_BYPASS", "false");
vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "test-account-id");

// Mock @t3-oss/env-nextjs to prevent server-side environment variable access errors
vi.mock("@t3-oss/env-nextjs", () => ({
  createEnv: vi.fn(() => ({
    NODE_ENV: "test",
    APP_ENV: "local",
    TURNSTILE_SECRET_KEY: "test-secret-key",
    RESEND_API_KEY: "test-resend-key",
    AIRTABLE_API_KEY: "test-airtable-key",
    AIRTABLE_BASE_ID: "test-base-id",
    AIRTABLE_TABLE_NAME: "test-table",
    EMAIL_FROM: "test@example.com",
    EMAIL_REPLY_TO: "reply@example.com",
    CSP_REPORT_URI: "https://example.com/csp-report",
    ADMIN_API_TOKEN: "test-admin-token",
    TURNSTILE_BYPASS: false,
    CLOUDFLARE_ACCOUNT_ID: "test-account-id",
    NEXT_PUBLIC_BASE_URL: "https://example.com",
  })),
}));

// Mock the env module directly
vi.mock("@/lib/env", () => {
  const mockEnv = {
    NODE_ENV: "test",
    APP_ENV: "local",
    TURNSTILE_SECRET_KEY: "test-secret-key",
    RESEND_API_KEY: "test-resend-key",
    AIRTABLE_API_KEY: "test-airtable-key",
    AIRTABLE_BASE_ID: "test-base-id",
    AIRTABLE_TABLE_NAME: "test-table",
    EMAIL_FROM: "test@example.com",
    EMAIL_REPLY_TO: "reply@example.com",
    CSP_REPORT_URI: "https://example.com/csp-report",
    ADMIN_API_TOKEN: "test-admin-token",
    ALLOW_MEMORY_RATE_LIMIT: false,
    CLOUDFLARE_ACCOUNT_ID: "test-account-id",
    NEXT_PUBLIC_BASE_URL: "https://example.com",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test-site-key-12345",
    NEXT_PUBLIC_DEPLOYMENT_PLATFORM: "development",
    NEXT_PUBLIC_TEST_MODE: false,
  } as Record<string, string | boolean | number | undefined>;

  const cloudflareContextSymbol = Symbol.for("__cloudflare-context__");
  const readCloudflareContextEnvValue = (key: string): string | undefined => {
    const context = (
      globalThis as typeof globalThis &
        Record<symbol, { env?: Record<string, unknown> } | undefined>
    )[cloudflareContextSymbol];
    const value = context?.env?.[key];

    return typeof value === "string" ? value : undefined;
  };
  const readProcessEnvValue = (key: string): string | undefined =>
    readCloudflareContextEnvValue(key) ?? process.env[key];

  return {
    env: mockEnv,
    serverEnvSchema: {},
    clientEnvSchema: {},
    runtimeEnv: mockEnv,
    getRuntimeEnvString: (key: string) => {
      const runtimeValue = readProcessEnvValue(key);
      if (runtimeValue !== undefined) {
        return runtimeValue;
      }

      const value = mockEnv[key];
      return typeof value === "string" ? value : undefined;
    },
    getRuntimeEnvBoolean: (key: string) => {
      const runtimeValue = readProcessEnvValue(key);
      if (runtimeValue !== undefined) {
        return runtimeValue === "true";
      }

      const value = mockEnv[key];
      return typeof value === "boolean" ? value : undefined;
    },
    getRuntimeNodeEnv: () => {
      const value = readProcessEnvValue("NODE_ENV") ?? mockEnv.NODE_ENV;
      return value === "development" ||
        value === "test" ||
        value === "production"
        ? value
        : undefined;
    },
    getRuntimeAppEnv: () => {
      const value = readProcessEnvValue("APP_ENV") ?? mockEnv.APP_ENV;
      return value === "local" ||
        value === "development" ||
        value === "test" ||
        value === "preview" ||
        value === "production"
        ? value
        : undefined;
    },
    isRuntimeDevelopment: () =>
      (readProcessEnvValue("NODE_ENV") ?? mockEnv.NODE_ENV) === "development",
    isRuntimeProduction: () =>
      (readProcessEnvValue("NODE_ENV") ?? mockEnv.NODE_ENV) === "production",
    isRuntimeTest: () =>
      (readProcessEnvValue("NODE_ENV") ?? mockEnv.NODE_ENV) === "test",
    isRuntimeCi: () => readProcessEnvValue("CI") === "true",
    isRuntimePlaywright: () =>
      readProcessEnvValue("PLAYWRIGHT_TEST") === "true",
    isRuntimeProductionBuildPhase: () =>
      readProcessEnvValue("NEXT_PHASE") === "phase-production-build",
    isRuntimeCloudflare: () =>
      readProcessEnvValue("DEPLOYMENT_PLATFORM") === "cloudflare" ||
      readProcessEnvValue("NEXT_PUBLIC_DEPLOYMENT_PLATFORM") === "cloudflare",
    requireEnvVar: (key: string) => {
      const value = mockEnv[key];
      if (!value || typeof value === "boolean" || typeof value === "number") {
        throw new Error(
          `Required environment variable ${key} is not set or is not a string`,
        );
      }
      return value;
    },
  };
});
