import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INQUIRY_TURNSTILE_ACTION } from "@/constants/turnstile-constants";
import { logger } from "@/lib/logger";
import { verifyLeadTurnstile } from "@/lib/security/lead-turnstile";
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
  let warnLog: ReturnType<typeof vi.spyOn>;
  let errorLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnLog = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    errorLog = vi.spyOn(logger, "error").mockImplementation(() => undefined);
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
    ).resolves.toEqual({ status: "verified" });
  });

  it("rejects a token solved on an unexpected hostname even when the action matches", async () => {
    stubSiteverify({
      success: true,
      hostname: "attacker.example",
      action: INQUIRY_TURNSTILE_ACTION,
    });

    await expect(
      verifyTurnstileDetailed("widget-token", "203.0.113.10"),
    ).resolves.toEqual({ status: "failed" });
    expect(warnLog).toHaveBeenCalledTimes(1);
    expect(warnLog).toHaveBeenCalledWith(
      "Turnstile verification rejected due to unexpected hostname",
      expect.objectContaining({ errorCode: "invalid-hostname" }),
    );
  });

  it("rejects a token issued for another action even when the hostname matches", async () => {
    stubSiteverify({
      success: true,
      hostname: ALLOWED_HOST,
      action: "newsletter_signup",
    });

    await expect(
      verifyTurnstileDetailed("widget-token", "203.0.113.10"),
    ).resolves.toEqual({ status: "failed" });
    expect(warnLog).toHaveBeenCalledTimes(1);
    expect(warnLog).toHaveBeenCalledWith(
      "Turnstile verification rejected due to mismatched action",
      expect.objectContaining({ errorCode: "invalid-action" }),
    );
  });

  it.each(["production", "test", "preview"])(
    "ignores TURNSTILE_BYPASS=true when NODE_ENV is %s",
    async (nodeEnv) => {
      vi.stubEnv("NODE_ENV", nodeEnv);
      vi.stubEnv("TURNSTILE_BYPASS", "true");
      const fetchMock = stubSiteverify({ success: false });

      await expect(
        verifyTurnstileDetailed("forged-token", "203.0.113.10"),
      ).resolves.toEqual({ status: "failed" });
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
    ).resolves.toEqual({ status: "service-unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a Cloudflare internal-error as service-unavailable, not a buyer rejection", async () => {
    stubSiteverify({ success: false, "error-codes": ["internal-error"] });

    await expect(
      verifyTurnstileDetailed("widget-token", "203.0.113.10"),
    ).resolves.toEqual({ status: "service-unavailable" });
  });

  it("rejects a token Cloudflare itself refuses as failed", async () => {
    stubSiteverify({
      success: false,
      "error-codes": ["invalid-input-response"],
    });

    await expect(
      verifyTurnstileDetailed("widget-token", "203.0.113.10"),
    ).resolves.toEqual({ status: "failed" });
  });

  // 同一个失败只在分类处记一次日志：运维看到的每次失败恰好一条。
  describe.each([
    {
      name: "provider rejection",
      arrange: () =>
        stubSiteverify({
          success: false,
          "error-codes": ["invalid-input-response"],
        }),
      level: "warn",
    },
    {
      name: "provider internal-error",
      arrange: () =>
        stubSiteverify({ success: false, "error-codes": ["internal-error"] }),
      level: "error",
    },
    {
      name: "hostname mismatch",
      arrange: () =>
        stubSiteverify({
          success: true,
          hostname: "attacker.example",
          action: INQUIRY_TURNSTILE_ACTION,
        }),
      level: "warn",
    },
    {
      name: "network failure",
      arrange: () =>
        vi.stubGlobal(
          "fetch",
          vi.fn(async () => {
            throw new TypeError("fetch failed");
          }),
        ),
      level: "error",
    },
    {
      name: "missing secret key",
      arrange: () => vi.stubEnv("TURNSTILE_SECRET_KEY", undefined),
      level: "error",
    },
  ] as const)("$name", ({ arrange, level }) => {
    it(`is logged exactly once, at ${level} level`, async () => {
      arrange();

      await verifyLeadTurnstile({
        token: "widget-token",
        clientIP: "203.0.113.10",
      });

      const total = warnLog.mock.calls.length + errorLog.mock.calls.length;
      expect(total).toBe(1);
      expect((level === "warn" ? warnLog : errorLog).mock.calls).toHaveLength(
        1,
      );
    });
  });
});
