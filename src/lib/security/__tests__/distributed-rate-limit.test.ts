import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MINUTE_MS } from "@/constants";
import {
  checkInquiryRateLimit,
  resetRateLimitStore,
} from "@/lib/security/distributed-rate-limit";
import { MemoryRateLimitStore } from "@/lib/security/stores/rate-limit-store";

const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: mockLoggerWarn,
    error: mockLoggerError,
    info: vi.fn(),
  },
}));

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

describe("distributed-rate-limit", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    process.env = { ...originalEnv, NODE_ENV: "test" };
    setEnv("UPSTASH_REDIS_REST_URL", undefined);
    setEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
    resetRateLimitStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetRateLimitStore();
    process.env = originalEnv;
  });

  it("allows 10 requests per minute and starts over after the window", async () => {
    vi.setSystemTime(1_700_000_000_000);
    const results = [];

    for (let i = 0; i < 10; i++) {
      results.push(await checkInquiryRateLimit("counting-user"));
    }

    expect(results.map((result) => result.remaining)).toEqual([
      9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
    ]);
    expect(results.every((result) => result.allowed)).toBe(true);

    await expect(checkInquiryRateLimit("counting-user")).resolves.toMatchObject(
      {
        allowed: false,
        remaining: 0,
        resetTime: 1_700_000_000_000 + MINUTE_MS,
        retryAfter: 60,
        deniedReason: "limit",
      },
    );

    vi.advanceTimersByTime(MINUTE_MS);
    await expect(checkInquiryRateLimit("counting-user")).resolves.toMatchObject(
      {
        allowed: true,
        remaining: 9,
        retryAfter: null,
      },
    );
  });

  it("keeps identifiers separate and warns once for the local store", async () => {
    await checkInquiryRateLimit("user-a");
    await checkInquiryRateLimit("user-b");
    await checkInquiryRateLimit("user-c");

    expect(
      mockLoggerWarn.mock.calls.filter((call) =>
        String(call[0]).includes("Using in-memory store"),
      ),
    ).toHaveLength(1);

    for (let i = 1; i < 10; i++) {
      await checkInquiryRateLimit("user-a");
    }

    expect((await checkInquiryRateLimit("user-a")).allowed).toBe(false);
    expect((await checkInquiryRateLimit("user-b")).allowed).toBe(true);
  });

  it("fails closed when the store rejects", async () => {
    const error = new DOMException("The operation was aborted", "AbortError");
    vi.spyOn(MemoryRateLimitStore.prototype, "increment").mockRejectedValueOnce(
      error,
    );

    await expect(checkInquiryRateLimit("failure-user")).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfter: 60,
      deniedReason: "storage_failure",
    });
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining("fail-closed"),
    );
    expect(mockLoggerError).toHaveBeenCalledWith(
      "[Rate Limit] Storage backend error details",
      { error },
    );
  });

  it("fails closed when production Upstash configuration is missing", async () => {
    setEnv("NODE_ENV", "production");
    resetRateLimitStore();

    await expect(checkInquiryRateLimit("missing-store")).resolves.toMatchObject(
      {
        allowed: false,
        deniedReason: "storage_failure",
      },
    );
  });

  it("reset clears the process-local counters", async () => {
    await checkInquiryRateLimit("reset-user");
    await checkInquiryRateLimit("reset-user");

    resetRateLimitStore();

    await expect(checkInquiryRateLimit("reset-user")).resolves.toMatchObject({
      allowed: true,
      remaining: 9,
    });
  });

  it("admits exactly 10 concurrent requests through the Upstash atomic increment", async () => {
    vi.useRealTimers();
    setEnv("UPSTASH_REDIS_REST_URL", "http://fake-redis:8080");
    setEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token");
    resetRateLimitStore();

    const counters = new Map<string, number>();
    const unknownCommands: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, options) => {
        const commands = JSON.parse(
          String((options as RequestInit).body),
        ) as string[][];
        const results = commands.map(([name, key]) => {
          if (name === "INCR") {
            const next = (counters.get(key!) ?? 0) + 1;
            counters.set(key!, next);
            return { result: next };
          }
          if (name === "PEXPIRE") return { result: 1 };
          if (name === "PTTL") return { result: MINUTE_MS };

          unknownCommands.push(String(name));
          return { result: 1 };
        });

        await Promise.resolve();
        return new Response(JSON.stringify(results), { status: 200 });
      }),
    );

    const results = await Promise.all(
      Array.from({ length: 11 }, () =>
        checkInquiryRateLimit("concurrent-redis-user"),
      ),
    );

    expect(unknownCommands).toEqual([]);
    expect(results.filter((result) => result.allowed)).toHaveLength(10);
  });
});
