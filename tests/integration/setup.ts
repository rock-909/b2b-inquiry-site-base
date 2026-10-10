import { afterEach, beforeEach, vi } from "vitest";

// 只替换 Next 的服务端标记；env/schema/业务模块均执行真实实现。
vi.mock("server-only", () => ({}));

function setTestEnvironment() {
  for (const [key, value] of Object.entries({
    NODE_ENV: "test",
    APP_ENV: "local",
    SKIP_ENV_VALIDATION: "false",
    NEXT_PUBLIC_TEST_MODE: "false",
    NEXT_PUBLIC_BASE_URL: "http://localhost",
    NEXT_PUBLIC_SITE_URL: "http://localhost",
    NEXT_PUBLIC_DEPLOYMENT_PLATFORM: "development",
    DEPLOYMENT_PLATFORM: "development",
    TURNSTILE_SECRET_KEY: "test-secret-key",
    TURNSTILE_ALLOWED_HOSTS: "localhost",
    TURNSTILE_BYPASS: "false",
    NEXT_PUBLIC_TURNSTILE_BYPASS: "false",
    RESEND_API_KEY: "test-resend-key",
    AIRTABLE_API_KEY: "test-airtable-key",
    AIRTABLE_BASE_ID: "test-base-id",
    AIRTABLE_TABLE_NAME: "test-table",
    EMAIL_FROM: "test@example.com",
    INQUIRY_RECIPIENT_EMAIL: "reply@example.com",
    RATE_LIMIT_PEPPER: "fixture-pepper-at-least-thirty-two-characters",
  }))
    vi.stubEnv(key, value);
  vi.stubEnv("UPSTASH_REDIS_REST_URL", undefined);
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
  // 导入期不得发网；各用例必须显式安装自己的出站夹具。
  vi.stubGlobal("fetch", () => {
    throw new Error("Fetch without integration fixture");
  });
}

setTestEnvironment();
beforeEach(setTestEnvironment);
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
