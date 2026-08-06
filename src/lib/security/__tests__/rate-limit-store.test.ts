import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createRateLimitStore,
  MemoryRateLimitStore,
  RedisRateLimitStore,
  resetRateLimitStoreWarnings,
} from "@/lib/security/stores/rate-limit-store";

const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));

function setEnv(key: string, value: string | undefined): void {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) {
    delete env[key];
  } else {
    env[key] = value;
  }
}

function createStalledJsonResponse(signal?: AbortSignal | null): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("["));
      signal?.addEventListener("abort", () => {
        controller.error(
          new DOMException("The operation was aborted", "AbortError"),
        );
      });
    },
  });

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("rate-limit-store", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    setEnv("UPSTASH_REDIS_REST_URL", undefined);
    setEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
    setEnv("NODE_ENV", undefined);
    resetRateLimitStoreWarnings();
  });

  describe("createRateLimitStore", () => {
    it("creates a Redis store when Upstash credentials exist", () => {
      setEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
      setEnv("UPSTASH_REDIS_REST_TOKEN", "token");

      const store = createRateLimitStore();

      expect(store).toBeInstanceOf(RedisRateLimitStore);
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "[Rate Limit] Using Upstash Redis store",
      );
    });

    it("throws when production has no distributed store configured", () => {
      setEnv("NODE_ENV", "production");

      expect(() => createRateLimitStore()).toThrow(
        "Production requires Upstash Redis",
      );
    });

    it("falls back to memory in development and logs the warning once", () => {
      const first = createRateLimitStore();
      const second = createRateLimitStore();

      expect(first).toBeInstanceOf(MemoryRateLimitStore);
      expect(second).toBeInstanceOf(MemoryRateLimitStore);
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        "[Rate Limit] Using in-memory store (development only)",
      );
      expect(
        mockLoggerWarn.mock.calls.filter(
          ([message]) =>
            message === "[Rate Limit] Using in-memory store (development only)",
        ),
      ).toHaveLength(1);
    });

    it("ignores ALLOW_MEMORY_RATE_LIMIT as a runtime enable switch outside production", () => {
      setEnv("ALLOW_MEMORY_RATE_LIMIT", "false");

      const store = createRateLimitStore();

      expect(store).toBeInstanceOf(MemoryRateLimitStore);
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        "[Rate Limit] Using in-memory store (development only)",
      );
    });

    it.each([
      ["URL", "UPSTASH_REDIS_REST_URL", "https://example.upstash.io"],
      ["token", "UPSTASH_REDIS_REST_TOKEN", "token"],
    ])(
      "falls back to memory when only the Upstash %s is configured in development",
      (_label, key, value) => {
        setEnv(key, value);

        const store = createRateLimitStore();

        expect(store).toBeInstanceOf(MemoryRateLimitStore);
        expect(mockLoggerInfo).not.toHaveBeenCalledWith(
          "[Rate Limit] Using Upstash Redis store",
        );
      },
    );

    it("re-emits the memory fallback warning after reset", () => {
      createRateLimitStore();
      resetRateLimitStoreWarnings();
      createRateLimitStore();

      expect(
        mockLoggerWarn.mock.calls.filter(
          ([message]) =>
            message === "[Rate Limit] Using in-memory store (development only)",
        ),
      ).toHaveLength(2);
    });

    it("emits the in-memory warning on the first fresh module load before any reset helper runs", async () => {
      vi.resetModules();
      mockLoggerWarn.mockClear();

      const freshModule =
        await import("@/lib/security/stores/rate-limit-store");
      const store = freshModule.createRateLimitStore();

      expect(store).toBeInstanceOf(freshModule.MemoryRateLimitStore);
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        "[Rate Limit] Using in-memory store (development only)",
      );
      freshModule.resetRateLimitStoreWarnings();
    });
  });

  describe("RedisRateLimitStore", () => {
    it("uses an atomic transaction for increment and ttl assignment", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(
            JSON.stringify([{ result: 1 }, { result: 1 }, { result: 60_000 }]),
            { status: 200 },
          ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");
      const result = await store.increment("unsafe/key?value=yes", 60_000);

      expect(result.count).toBe(1);
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
        }),
      );
    });

    it("passes abort signals to every Upstash fetch call", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([{ result: 1 }, { result: 1 }, { result: 60_000 }]),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              result: [{ result: "1" }, { result: 60_000 }],
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ result: 1 }), { status: 200 }),
        );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");

      await store.increment("idem:key", 60_000);
      await store.get("idem:key");
      await store.delete("idem:key");

      expect(
        fetchMock.mock.calls.map(([, init]) => (init as RequestInit).signal),
      ).toEqual([
        expect.any(AbortSignal),
        expect.any(AbortSignal),
        expect.any(AbortSignal),
      ]);
    });

    it("aborts a pending Upstash increment fetch after the store timeout", async () => {
      vi.useFakeTimers();
      const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
        const signal = init?.signal;

        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        });
      });
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");
      const pendingIncrement = store.increment("idem:key", 60_000);
      await Promise.resolve();

      const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(requestInit.signal).toBeInstanceOf(AbortSignal);

      const abortExpectation =
        expect(pendingIncrement).rejects.toThrow("aborted");
      await vi.advanceTimersByTimeAsync(5_000);

      expect(requestInit.signal?.aborted).toBe(true);
      await abortExpectation;
      vi.useRealTimers();
    });

    it("aborts when an Upstash response body stalls during JSON parsing", async () => {
      vi.useFakeTimers();
      const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
        return createStalledJsonResponse(init?.signal);
      });
      vi.stubGlobal("fetch", fetchMock);

      try {
        const store = new RedisRateLimitStore(
          "https://example.upstash.io",
          "t",
        );
        const pendingIncrement = store.increment("idem:key", 60_000);
        await Promise.resolve();

        const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
        const abortExpectation =
          expect(pendingIncrement).rejects.toThrow("aborted");
        await vi.advanceTimersByTimeAsync(5_000);

        expect(requestInit.signal?.aborted).toBe(true);
        await abortExpectation;
      } finally {
        vi.useRealTimers();
      }
    });

    it("accepts increment responses wrapped under result arrays", async () => {
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
      const result = await store.increment("idem:key", 60_000);

      expect(result.count).toBe(2);
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it("accepts direct array increment responses and preserves the exact ttl", async () => {
      vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify([2, 1, 45_000]), { status: 200 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");
      await expect(store.increment("idem:key", 60_000)).resolves.toEqual({
        count: 2,
        expiresAt: 1_700_000_045_000,
      });
    });

    it("accepts zero ttl responses instead of treating them as invalid", async () => {
      vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
      const fetchMock = vi.fn(
        async () =>
          new Response(
            JSON.stringify([{ result: 1 }, { result: 1 }, { result: 0 }]),
            { status: 200 },
          ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");
      await expect(store.increment("idem:key", 60_000)).resolves.toEqual({
        count: 1,
        expiresAt: 1_700_000_000_000,
      });
    });

    it("gets count and ttl via POST pipeline instead of path-style REST", async () => {
      vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
      const fetchMock = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              result: [{ result: "3" }, { result: 45_000 }],
            }),
            { status: 200 },
          ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");
      const result = await store.get("unsafe/key?value=yes");

      expect(result).toEqual({
        count: 3,
        expiresAt: 1_700_000_045_000,
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.upstash.io/pipeline",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer t",
            "Content-Type": "application/json",
          },
          body: JSON.stringify([
            ["GET", "unsafe/key?value=yes"],
            ["PTTL", "unsafe/key?value=yes"],
          ]),
        }),
      );
    });

    it.each([
      ["negative", -1],
      ["non-finite", "oops"],
      ["infinite", Number.POSITIVE_INFINITY],
    ])(
      "throws when the atomic increment transaction returns a %s ttl",
      async (_label, ttl) => {
        const fetchMock = vi.fn(async () => ({
          ok: true,
          json: async () => [{ result: 1 }, { result: 1 }, { result: ttl }],
        }));
        vi.stubGlobal("fetch", fetchMock);

        const store = new RedisRateLimitStore(
          "https://example.upstash.io",
          "t",
        );

        await expect(store.increment("idem:key", 60_000)).rejects.toThrow(
          "invalid TTL",
        );
        expect(mockLoggerError).toHaveBeenCalledWith(
          "[Rate Limit] Upstash transaction returned invalid TTL",
        );
      },
    );

    it.each([
      ["wrapped null result", () => ({ result: null })],
      [
        "prototype result array",
        () =>
          Object.create({
            result: [{ result: 1 }, { result: 1 }, { result: 60_000 }],
          }),
      ],
      ["primitive payload", () => 1],
      ["null payload", () => null],
      ["short multi-exec payload", () => [{ result: 1 }, { result: 1 }]],
    ])("throws when increment returns a malformed %s", async (_label, json) => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json,
      }));
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");

      await expect(store.increment("idem:key", 60_000)).rejects.toThrow(
        "expected multi-exec results",
      );
    });

    it("throws when the atomic increment transaction returns a non-numeric count", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              { result: "NaN" },
              { result: 1 },
              { result: 60_000 },
            ]),
            { status: 200 },
          ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");

      await expect(store.increment("idem:key", 60_000)).rejects.toThrow(
        "expected numeric count",
      );
    });

    it("logs and throws when the increment pipeline returns a non-200 response", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "boom" }), {
            status: 503,
            statusText: "boom",
          }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");

      await expect(store.increment("idem:key", 60_000)).rejects.toThrow(
        "Upstash rate limit operation failed: 503",
      );
      expect(mockLoggerError).toHaveBeenCalledWith(
        "[Rate Limit] Upstash pipeline failed: boom",
      );
    });

    it.each([
      ["no count", { result: [{ result: null }, { result: 45_000 }] }],
      ["omitted count", { result: [undefined, { result: 45_000 }] }],
      ["wrapped non-array result", { result: null }],
      ["primitive payload", 1],
      ["null payload", null],
      ["short payload", [{ result: "3" }]],
    ])("returns null when GET returns %s", async (_label, payload) => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => payload,
      }));
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");

      await expect(store.get("idem:key")).resolves.toBeNull();
    });

    it("coerces missing or negative GET ttl values to an immediate expiry", async () => {
      vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
      const fetchMock = vi.fn(
        async () =>
          new Response(
            JSON.stringify({ result: [{ result: "3" }, { result: -1 }] }),
            { status: 200 },
          ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");

      await expect(store.get("idem:key")).resolves.toEqual({
        count: 3,
        expiresAt: 1_700_000_000_000,
      });
    });

    it("coerces zero GET ttl values to an immediate expiry", async () => {
      vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
      const fetchMock = vi.fn(
        async () =>
          new Response(
            JSON.stringify({ result: [{ result: "3" }, { result: 0 }] }),
            { status: 200 },
          ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");

      await expect(store.get("idem:key")).resolves.toEqual({
        count: 3,
        expiresAt: 1_700_000_000_000,
      });
    });

    it("coerces infinite GET ttl values to an immediate expiry", async () => {
      vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          result: [{ result: "3" }, { result: Number.POSITIVE_INFINITY }],
        }),
      }));
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");

      await expect(store.get("idem:key")).resolves.toEqual({
        count: 3,
        expiresAt: 1_700_000_000_000,
      });
    });

    it("throws when GET returns a non-200 response", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "boom" }), {
            status: 503,
            statusText: "boom",
          }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");

      await expect(store.get("idem:key")).rejects.toThrow("Upstash get failed");
    });

    it("throws when GET returns a non-numeric count", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              result: [{ result: "not-a-number" }, { result: 45_000 }],
            }),
            { status: 200 },
          ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");

      await expect(store.get("idem:key")).rejects.toThrow(
        "expected numeric count",
      );
    });

    it("deletes via DEL command body instead of HTTP DELETE path", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ result: 1 }), { status: 200 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");
      await store.delete("unsafe/key?value=yes");

      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.upstash.io",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer t",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(["DEL", "unsafe/key?value=yes"]),
        }),
      );
    });

    it("does not log when delete succeeds", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ result: 1 }), { status: 200 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");
      await expect(store.delete("idem:key")).resolves.toBeUndefined();

      expect(mockLoggerError).not.toHaveBeenCalled();
    });

    it("logs delete failures instead of throwing", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "boom" }), {
            status: 500,
            statusText: "boom",
          }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const store = new RedisRateLimitStore("https://example.upstash.io", "t");
      await expect(store.delete("idem:key")).resolves.toBeUndefined();

      expect(mockLoggerError).toHaveBeenCalledWith(
        "[Rate Limit] Failed to delete rate limit key: boom",
      );
    });
  });

  describe("MemoryRateLimitStore", () => {
    it("increments active entries and expires stale ones", async () => {
      vi.useFakeTimers();
      const store = new MemoryRateLimitStore();

      await expect(store.increment("rate:key", 100)).resolves.toMatchObject({
        count: 1,
      });
      await expect(store.increment("rate:key", 100)).resolves.toMatchObject({
        count: 2,
      });
      await expect(store.get("rate:key")).resolves.toMatchObject({ count: 2 });

      vi.setSystemTime(Date.now() + 200);
      await expect(store.get("rate:key")).resolves.toBeNull();
      vi.useRealTimers();
    });

    it("deletes keys explicitly", async () => {
      const store = new MemoryRateLimitStore();

      await store.increment("rate:key", 100);
      await store.delete("rate:key");

      await expect(store.get("rate:key")).resolves.toBeNull();
    });

    it("creates a fresh window after an entry has clearly expired", async () => {
      vi.useFakeTimers();
      const store = new MemoryRateLimitStore();

      await store.increment("rate:key", 100);
      vi.advanceTimersByTime(101);

      await expect(store.get("rate:key")).resolves.toBeNull();
      await expect(store.increment("rate:key", 100)).resolves.toMatchObject({
        count: 1,
      });
      vi.useRealTimers();
    });

    it("treats entries expiring exactly now as stale during increment", async () => {
      vi.useFakeTimers();
      const store = new MemoryRateLimitStore();
      const start = Date.now();

      await store.increment("rate:key", 100);
      vi.setSystemTime(start + 100);

      await expect(store.increment("rate:key", 100)).resolves.toMatchObject({
        count: 1,
        expiresAt: start + 200,
      });
      vi.useRealTimers();
    });

    it("cleanup removes expired entries from the internal map while preserving live ones", async () => {
      vi.useFakeTimers();
      const store = new MemoryRateLimitStore();
      const start = Date.now();

      await store.increment("expired:key", 100);
      await store.increment("live:key", 200);
      vi.setSystemTime(start + 100);
      store.cleanup();

      const internalStore = (
        store as unknown as { store: Map<string, unknown> }
      ).store;
      expect(internalStore.has("expired:key")).toBe(false);
      expect(internalStore.has("live:key")).toBe(true);
      vi.useRealTimers();
    });

    it("removes expired entries from the internal map during reads", async () => {
      vi.useFakeTimers();
      const store = new MemoryRateLimitStore();
      const start = Date.now();

      await store.increment("rate:key", 100);
      vi.setSystemTime(start + 100);

      await expect(store.get("rate:key")).resolves.toBeNull();
      const internalStore = (
        store as unknown as { store: Map<string, unknown> }
      ).store;
      expect(internalStore.has("rate:key")).toBe(false);
      vi.useRealTimers();
    });
  });
});
