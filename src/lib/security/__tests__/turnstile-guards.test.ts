import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INQUIRY_TURNSTILE_ACTION } from "@/constants/turnstile-constants";
import { logger } from "@/lib/logger";
import { verifyTurnstileDetailed } from "@/lib/security/turnstile";

// 全局 setup 的 env mock 自带 TURNSTILE_SECRET_KEY 兜底值，会让"缺密钥"无法复现；
// 这里让运行时环境变量成为唯一来源，被测的 turnstile.ts 仍是真实实现。
vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...actual,
    env: { ...actual.env, TURNSTILE_SECRET_KEY: undefined },
    getRuntimeEnvString: (key: string) => process.env[key],
    getRuntimeEnvBoolean: (key: string) => {
      const value = process.env[key];
      return value === undefined ? undefined : value === "true";
    },
  };
});

const ALLOWED_HOST = "buyer-site.example";
const SECRET_KEY = "test-secret-not-the-official-dummy";

function stubSiteverify(result: Record<string, unknown>) {
  const fetchMock = vi.fn(async () => Response.json(result));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// 这里走真实的 verifyTurnstileDetailed，只替换对 Cloudflare 的网络出口。
describe("verifyTurnstileDetailed server-side guards", () => {
  beforeEach(() => {
    vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    vi.spyOn(logger, "info").mockImplementation(() => undefined);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("TURNSTILE_BYPASS", "false");
    vi.stubEnv("TURNSTILE_SECRET_KEY", SECRET_KEY);
    vi.stubEnv("TURNSTILE_ALLOWED_HOSTS", ALLOWED_HOST);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("accepts a token whose hostname and action both match", async () => {
    stubSiteverify({
      success: true,
      hostname: ALLOWED_HOST,
      action: INQUIRY_TURNSTILE_ACTION,
    });

    await expect(
      verifyTurnstileDetailed("widget-token", "203.0.113.10"),
    ).resolves.toEqual({ success: true });
  });

  it("rejects a token solved on an unexpected hostname even when the action matches", async () => {
    stubSiteverify({
      success: true,
      hostname: "attacker.example",
      action: INQUIRY_TURNSTILE_ACTION,
    });

    await expect(
      verifyTurnstileDetailed("widget-token", "203.0.113.10"),
    ).resolves.toEqual({
      success: false,
      errorCodes: ["invalid-hostname"],
    });
  });

  it("rejects a token issued for another action even when the hostname matches", async () => {
    stubSiteverify({
      success: true,
      hostname: ALLOWED_HOST,
      action: "newsletter_signup",
    });

    await expect(
      verifyTurnstileDetailed("widget-token", "203.0.113.10"),
    ).resolves.toEqual({
      success: false,
      errorCodes: ["invalid-action"],
    });
  });

  it.each(["production", "test", "preview"])(
    "ignores TURNSTILE_BYPASS=true when NODE_ENV is %s",
    async (nodeEnv) => {
      vi.stubEnv("NODE_ENV", nodeEnv);
      vi.stubEnv("TURNSTILE_BYPASS", "true");
      const fetchMock = stubSiteverify({ success: false });

      await expect(
        verifyTurnstileDetailed("forged-token", "203.0.113.10"),
      ).resolves.toEqual({ success: false });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("fails closed without calling Cloudflare when TURNSTILE_SECRET_KEY is missing", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", undefined);
    const fetchMock = stubSiteverify({
      success: true,
      hostname: ALLOWED_HOST,
      action: INQUIRY_TURNSTILE_ACTION,
    });

    await expect(
      verifyTurnstileDetailed("widget-token", "203.0.113.10"),
    ).resolves.toEqual({
      success: false,
      errorCodes: ["not-configured"],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
