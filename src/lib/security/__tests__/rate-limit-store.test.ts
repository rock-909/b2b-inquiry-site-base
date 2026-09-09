import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRateLimitStore,
  RedisRateLimitStore,
  UPSTASH_OPERATION_TIMEOUT_MS,
} from "@/lib/security/stores/rate-limit-store";

const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mockLoggerError,
  },
}));

function createStalledJsonResponse(signal: AbortSignal | null | undefined) {
  return {
    ok: true,
    json: () =>
      new Promise<never>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted", "AbortError"));
        });
      }),
  } as unknown as Response;
}

describe("rate-limit-store", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("RedisRateLimitStore", () => {
    it("increments atomically and returns the exact ttl", async () => {
      vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
      const fetchMock = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              result: [{ result: 2 }, { result: 1 }, { result: 45_000 }],
            }),
            { status: 200 },
          ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");

      await expect(
        store.increment("unsafe/key?value=yes", 60_000),
      ).resolves.toEqual({
        count: 2,
        expiresAt: 1_700_000_045_000,
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.upstash.io/multi-exec",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer t",
            "Content-Type": "application/json",
          },
          body: JSON.stringify([
            ["INCR", "unsafe/key?value=yes"],
            ["PEXPIRE", "unsafe/key?value=yes", "60000", "NX"],
            ["PTTL", "unsafe/key?value=yes"],
          ]),
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("aborts a pending operation at the configured timeout", async () => {
      vi.useFakeTimers();
      const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        });
      });
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");
      const pending = store.increment("idem:key", 60_000);
      await Promise.resolve();

      const signal = (fetchMock.mock.calls[0]?.[1] as RequestInit).signal;
      const rejection = expect(pending).rejects.toThrow("aborted");
      await vi.advanceTimersByTimeAsync(UPSTASH_OPERATION_TIMEOUT_MS);

      expect(signal?.aborted).toBe(true);
      await rejection;
    });

    it("keeps the timeout active while the response body is being read", async () => {
      vi.useFakeTimers();
      const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
        createStalledJsonResponse(init?.signal),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");
      const pending = store.increment("idem:key", 60_000);
      await Promise.resolve();

      const rejection = expect(pending).rejects.toThrow("aborted");
      await vi.advanceTimersByTimeAsync(UPSTASH_OPERATION_TIMEOUT_MS);

      await rejection;
    });

    it.each([
      ["direct array", [2, 1, 45_000]],
      [
        "wrapped array",
        { result: [{ result: 2 }, { result: 1 }, { result: 45_000 }] },
      ],
    ])("accepts a %s increment response", async (_name, payload) => {
      vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () => new Response(JSON.stringify(payload), { status: 200 }),
        ),
      );

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");

      await expect(store.increment("idem:key", 60_000)).resolves.toEqual({
        count: 2,
        expiresAt: 1_700_000_045_000,
      });
    });

    it.each([
      ["missing array", { result: null }],
      ["short array", [{ result: 1 }, { result: 1 }]],
      [
        "non-numeric count",
        [{ result: "NaN" }, { result: 1 }, { result: 60_000 }],
      ],
      ["negative ttl", [{ result: 1 }, { result: 1 }, { result: -1 }]],
      ["negative count", [{ result: -1 }, { result: 1 }, { result: 60_000 }]],
      [
        "fractional count",
        [{ result: 1.5 }, { result: 1 }, { result: 60_000 }],
      ],
      ["null ttl", [{ result: 1 }, { result: 1 }, { result: null }]],
    ])("rejects a malformed %s response", async (_name, payload) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () => new Response(JSON.stringify(payload), { status: 200 }),
        ),
      );

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");

      await expect(store.increment("idem:key", 60_000)).rejects.toThrow(
        /expected multi-exec results|expected numeric count|invalid TTL/i,
      );
    });

    it("throws and logs a non-200 response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(JSON.stringify({ error: "boom" }), {
              status: 503,
              statusText: "boom",
            }),
        ),
      );

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");

      await expect(store.increment("idem:key", 60_000)).rejects.toThrow(
        "Upstash rate limit operation failed: 503",
      );
      expect(mockLoggerError).toHaveBeenCalledWith(
        "[Rate Limit] Upstash pipeline failed: boom",
      );
    });
  });

  it("keeps a process-local count and starts a new window after expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    const store = new MemoryRateLimitStore();

    await expect(store.increment("rate:key", 100)).resolves.toEqual({
      count: 1,
      expiresAt: 1_700_000_000_100,
    });
    await expect(store.increment("rate:key", 100)).resolves.toMatchObject({
      count: 2,
    });

    vi.advanceTimersByTime(100);
    await expect(store.increment("rate:key", 100)).resolves.toEqual({
      count: 1,
      expiresAt: 1_700_000_000_200,
    });
  });
});
