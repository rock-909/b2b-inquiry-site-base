import { afterEach, describe, expect, it, vi } from "vitest";

const { getRuntimeEnvStringMock } = vi.hoisted(() => ({
  getRuntimeEnvStringMock: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getRuntimeEnvString: getRuntimeEnvStringMock,
}));

// 闩锁模块在 Upstash 故障路径会写 error 日志；console gate 会拦截未预期的
// console.error，这里静默 logger，让测试专注验证返回值语义。
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  hasRecentInquiryFailure,
  isInquiryObservabilityConfigured,
  recordInquiryIncident,
} from "@/lib/observability/inquiry-failure-latch";

function configuredFetch() {
  getRuntimeEnvStringMock.mockImplementation((key: string) =>
    key === "UPSTASH_REDIS_REST_URL"
      ? "https://upstash.example"
      : key === "UPSTASH_REDIS_REST_TOKEN"
        ? "token-123"
        : undefined,
  );
}

function notConfigured() {
  getRuntimeEnvStringMock.mockReturnValue(undefined);
}

describe("inquiry failure latch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports configured only when both Upstash vars exist", () => {
    configuredFetch();
    expect(isInquiryObservabilityConfigured()).toBe(true);

    notConfigured();
    expect(isInquiryObservabilityConfigured()).toBe(false);
  });

  it("writes the latch with kind/timestamp and a 30-minute TTL", async () => {
    configuredFetch();
    const mockFetch = vi.fn(async () => new Response("OK"));
    vi.stubGlobal("fetch", mockFetch);

    await recordInquiryIncident("delivery_failed", "INQ-test");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("set/obs:inquiry:recent-failure/");
    expect(url).toContain("/ex/1800");
    expect(init.headers).toMatchObject({ Authorization: "Bearer token-123" });

    // 值是 URL 编码的 JSON，含事故类型与时间戳，不含 PII 字段名
    const encoded = url.split("recent-failure/")[1]!.split("/ex/")[0]!;
    const payload = JSON.parse(decodeURIComponent(encoded)) as {
      kind: string;
      at: string;
      referenceId?: string;
    };
    expect(payload.kind).toBe("delivery_failed");
    expect(payload.at).toBeTypeOf("string");
    expect(payload.referenceId).toBe("INQ-test");
  });

  it("never throws when Upstash is unreachable — the buyer response must not change", async () => {
    configuredFetch();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      recordInquiryIncident("unexpected_inquiry_error"),
    ).resolves.toBeUndefined();

    errorSpy.mockRestore();
  });

  it("treats an existing latch as a recent failure", async () => {
    configuredFetch();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          result: '{"kind":"delivery_failed","at":"2026-08-24T12:00:00.000Z"}',
        }),
      ),
    );

    await expect(hasRecentInquiryFailure()).resolves.toBe(true);
  });

  it("returns false when no latch exists", async () => {
    configuredFetch();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ result: null })),
    );

    await expect(hasRecentInquiryFailure()).resolves.toBe(false);
  });

  it("returns null (cannot assess) when unconfigured or unreadable", async () => {
    notConfigured();
    await expect(hasRecentInquiryFailure()).resolves.toBeNull();

    configuredFetch();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    await expect(hasRecentInquiryFailure()).resolves.toBeNull();
  });
});
