/**
 * Distributed Rate Limit Tests
 *
 * Tests for the distributed rate limiting module that supports
 * in-memory and Redis-compatible storage backends.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MINUTE_MS } from "@/constants";

import {
  checkDistributedRateLimit,
  createRateLimitHeaders,
  RATE_LIMIT_PRESETS,
  resetRateLimitStore,
} from "../distributed-rate-limit";

// Use vi.hoisted for mock functions
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());
const mockLoggerInfo = vi.hoisted(() => vi.fn());

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: mockLoggerWarn,
    error: mockLoggerError,
    info: mockLoggerInfo,
    debug: vi.fn(),
  },
}));

/**
 * Type-safe environment variable helper for tests.
 */
function setEnv(key: string, value: string | undefined): void {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) {
    delete env[key];
  } else {
    env[key] = value;
  }
}

/**
 * 让 store 的 increment 拒绝：网络挂了、Redis 拒连接这一类。
 *
 * 错误对象由调用方给。实现现在的 catch 块不看错误是什么，但「不看」正是要守的
 * 东西：有人给超时加一条特判、让它跟普通错误走不同的路，得有测试红。
 */
async function breakIncrement(error: unknown): Promise<void> {
  const mod = await import("@/lib/security/stores/rate-limit-store");
  vi.spyOn(mod, "createRateLimitStore").mockReturnValue({
    increment: vi.fn().mockRejectedValue(error),
  } as unknown as ReturnType<typeof mod.createRateLimitStore>);
}

/**
 * 让 store 根本建不起来：生产环境缺 Upstash 配置时，构造函数就抛。
 *
 * store 是第一次请求时才惰性建的，而 `getRateLimitStore()` 写在 try 里面，所以
 * 这个抛出跟 increment 失败落在同一个 catch，一样走 fail-closed，
 * 不是一条独立的启动期 fail-closed 通道。
 */
async function breakFactory(error: unknown): Promise<void> {
  const mod = await import("@/lib/security/stores/rate-limit-store");
  vi.spyOn(mod, "createRateLimitStore").mockImplementation(() => {
    throw error;
  });
}

describe("distributed-rate-limit", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetRateLimitStore();
    // Reset environment to ensure memory store is used
    process.env = { ...originalEnv };
    setEnv("UPSTASH_REDIS_REST_URL", undefined);
    setEnv("UPSTASH_REDIS_REST_TOKEN", undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRateLimitStore();
    process.env = originalEnv;
  });

  // =========================================================================
  // 1. MemoryRateLimitStore Tests (via checkDistributedRateLimit)
  // =========================================================================
  describe("MemoryRateLimitStore (default)", () => {
    // 原来是三条：第一次请求 remaining 是 max-1、第二次是 max-2、窗口过期后回到
    // max-1。三条各断一个数，合起来才是「每次减一，过期归零」这一件事。写成一串
    // 计数，中间断了哪一步都看得出来是哪一步。
    //
    // 过期这一步先把额度耗光再等。内存 store 里两种情况走的是同一个分支（只看
    // `entry.expiresAt > now`），所以这不是多覆盖了一条代码路径；它守的是买家侧
    // 那个后果：发满十次询盘之后，一分钟到了必须能再发，不能被永久挡住。
    it("counts each request down and starts over after the window", async () => {
      const identifier = "counting-user";
      const max = RATE_LIMIT_PRESETS.inquiry.maxRequests;

      // 成功路径的每个字段都要钉：额度内的请求不该带 retryAfter，resetTime 要落在
      // 一个窗口之后。原来这两条各自有独立测试，删的时候以为被拦截那条包住了，
      // 其实没有——那条钉的是被拦时的值。把 `retryAfter` 改成 `allowed ? 1 : …`，
      // 只看被拦路径是发现不了的。
      vi.setSystemTime(1_700_000_000_000);
      const first = await checkDistributedRateLimit(identifier, "inquiry");
      expect(first).toEqual({
        allowed: true,
        remaining: max - 1,
        resetTime: 1_700_000_000_000 + MINUTE_MS,
        retryAfter: null,
      });

      // 额度内的每一次都要钉，不能只看头几次再跳到被拦那次。中间某一次多记一笔
      // （`entry.count += entry.count === 3 ? 2 : 1`），前几次照样对、到限照样拦，
      // 只有把整串数列出来才看得见那个跳号。
      //
      // 期望值写死不写 `max - i`：后者是 `Math.max(0, maxRequests - count)` 的抄写，
      // 实现算错它会跟着错。写死就得先钉住上限确实是 10，不然改了配置这串数会
      // 变成对不上的红，而不是提醒人来改。
      expect(max).toBe(10);
      const allowedResults = [first];
      for (let i = 1; i < max; i++) {
        allowedResults.push(
          await checkDistributedRateLimit(identifier, "inquiry"),
        );
      }
      expect(allowedResults.map((result) => result.remaining)).toEqual([
        9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
      ]);
      expect(allowedResults.map((result) => result.allowed)).toEqual(
        Array.from({ length: max }, () => true),
      );

      const blocked = await checkDistributedRateLimit(identifier, "inquiry");
      expect(blocked.allowed).toBe(false);

      vi.advanceTimersByTime(MINUTE_MS + 1);

      const afterWindow = await checkDistributedRateLimit(
        identifier,
        "inquiry",
      );
      expect(afterWindow.allowed).toBe(true);
      expect(afterWindow.remaining).toBe(max - 1);
    });

    // 「第一次用会 warn」和「只 warn 一次」是同一条断言的两半：三次请求后正好
    // 一条，两件事一起证完。分开写的话，前一条在 warn 变成每次都发时还是绿的。
    it("warns exactly once that the in-memory store is in use", async () => {
      await checkDistributedRateLimit("user-a", "inquiry");
      await checkDistributedRateLimit("user-b", "inquiry");
      await checkDistributedRateLimit("user-c", "inquiry");

      const warnCalls = mockLoggerWarn.mock.calls.filter((call) =>
        String(call[0]).includes("Using in-memory store"),
      );
      expect(warnCalls).toHaveLength(1);
    });
  });

  // =========================================================================
  // 2. checkDistributedRateLimit Tests
  // =========================================================================
  describe("storage failures", () => {
    const storageFailures = [
      {
        label: "store increment rejects",
        breakStore: breakIncrement,
        error: new Error("boom"),
      },
      {
        label: "store increment times out",
        breakStore: breakIncrement,
        error: new DOMException("The operation was aborted", "AbortError"),
      },
      {
        label: "store factory throws",
        breakStore: breakFactory,
        error: new Error("factory boom"),
      },
    ];

    it.each(storageFailures)(
      "fails closed when $label",
      async ({ breakStore, error, label }) => {
        await breakStore(error);
        const config = RATE_LIMIT_PRESETS.inquiry;

        const result = await checkDistributedRateLimit(
          `failure-${label}`,
          "inquiry",
        );

        expect(result).toMatchObject({
          allowed: false,
          remaining: 0,
          deniedReason: "storage_failure",
        });
        expect(result.retryAfter).toBe(Math.ceil(config.windowMs / 1000));

        // 存储失败要留痕：warn 说明请求被 fail-closed，error 带原始错误供排查。
        //
        // 断的是「就是刚才扔进去那个对象」，不是 `expect.any(Error)`。实现原样
        // 转发 `{ error }`，所以身份可以对上；写成 any(Error) 反而会误伤——
        // 超时那两行扔的 DOMException 在这套测试环境里就不算 Error 的实例。
        expect(mockLoggerWarn).toHaveBeenCalledWith(
          expect.stringContaining("fail-closed"),
        );
        expect(mockLoggerError).toHaveBeenCalledWith(
          "[Rate Limit] Storage backend error details",
          { error },
        );
      },
    );
  });

  describe("checkDistributedRateLimit", () => {
    // 原来这里四条：额度内放行、remaining 算得对、到限拦下、拦下时有
    // retryAfter。前两条被上面的计数测试和 preset 表各证过一遍。后两条并进下面
    // 这条：它把被拦那次的五个字段全钉死，包括 retryAfter 的确切秒数，比
    // 「不是 null 且大于 0」严。
    //
    // 它只管被拦那一次。「前十次都得放行」不在这条的射程里，那是上面计数测试
    // 的事；成功响应的 resetTime 也一样，这里钉的是被拦响应的。
    it("returns exact blocked metadata when the limit is exceeded", async () => {
      vi.setSystemTime(1_700_000_000_000);
      const identifier = "blocked-metadata-user";

      for (let i = 0; i < 10; i++) {
        await checkDistributedRateLimit(identifier, "inquiry");
      }

      const result = await checkDistributedRateLimit(identifier, "inquiry");

      expect(result).toMatchObject({
        allowed: false,
        remaining: 0,
        resetTime: 1_700_000_000_000 + MINUTE_MS,
        retryAfter: Math.ceil(MINUTE_MS / 1000),
        deniedReason: "limit",
      });
    });

    // 「窗口过期后重新放行」上面那条计数测试已经走过，而且还断了过期后
    // remaining 回到 max-1，比这里只看 allowed 更细。
    it("should track different identifiers separately", async () => {
      // Exhaust limit for user-a
      for (let i = 0; i < 10; i++) {
        await checkDistributedRateLimit("user-a", "inquiry");
      }
      const blockedUserA = await checkDistributedRateLimit("user-a", "inquiry");

      // user-b should still be allowed
      const allowedUserB = await checkDistributedRateLimit("user-b", "inquiry");

      expect(blockedUserA.allowed).toBe(false);
      expect(allowedUserB.allowed).toBe(true);
    });
  });

  // =========================================================================
  // 4. createRateLimitHeaders Tests
  // =========================================================================
  describe("createRateLimitHeaders", () => {
    // 原来五条，每条只看一个 header，用的是五份几乎一样的 result，三个 header
    // 的值原来都有人断到。合成两行是去重，不是补覆盖：五份输入其实只有放行和
    // 拦下两种形状，同一形状下三个 header 一起断完，比拆成五条好读，也不会再有
    // 人加一条只看一个字段的新用例。
    const RESET_TIME = 1_700_000_000_000 + MINUTE_MS;

    it.each([
      {
        name: "allowed request keeps Retry-After off",
        result: {
          allowed: true,
          remaining: 3,
          resetTime: RESET_TIME,
          retryAfter: null,
        },
        expected: {
          "X-RateLimit-Remaining": "3",
          "X-RateLimit-Reset": String(RESET_TIME),
          "Retry-After": null,
        },
      },
      {
        name: "blocked request carries Retry-After and zero remaining",
        result: {
          allowed: false,
          remaining: 0,
          resetTime: RESET_TIME,
          retryAfter: 30,
        },
        expected: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(RESET_TIME),
          "Retry-After": "30",
        },
      },
    ])("$name", ({ result, expected }) => {
      const headers = createRateLimitHeaders(result);

      for (const [key, value] of Object.entries(expected)) {
        expect(headers.get(key), key).toBe(value);
      }
    });
  });

  // =========================================================================
  // 5. RATE_LIMIT_PRESETS Tests
  // =========================================================================
  describe("RATE_LIMIT_PRESETS", () => {
    it("should have valid config for all presets", () => {
      const presets = Object.keys(RATE_LIMIT_PRESETS) as Array<
        keyof typeof RATE_LIMIT_PRESETS
      >;

      for (const preset of presets) {
        const config = RATE_LIMIT_PRESETS[preset];

        expect(config.maxRequests).toBeGreaterThan(0);
        expect(config.windowMs).toBeGreaterThan(0);
        expect(config.maxRequests).toBeTypeOf("number");
        expect(config.windowMs).toBeTypeOf("number");
      }
    });

    it("pins the inquiry preset at 10 requests per minute", () => {
      expect(RATE_LIMIT_PRESETS.inquiry).toEqual({
        maxRequests: 10,
        windowMs: MINUTE_MS,
      });
    });
  });

  describe("resetRateLimitStore", () => {
    it("should clear all rate limit state", async () => {
      // Create some entries
      await checkDistributedRateLimit("reset-user-1", "inquiry");
      await checkDistributedRateLimit("reset-user-2", "inquiry");

      // Reset the store
      resetRateLimitStore();

      // New requests should get full limit (store recreated)
      const result = await checkDistributedRateLimit("reset-user-1", "inquiry");
      expect(result.remaining).toBe(10 - 1);
    });

    it("should cause warning to be logged again after reset", async () => {
      // First store creation
      await checkDistributedRateLimit("first-init", "inquiry");
      const initialWarnCount = mockLoggerWarn.mock.calls.filter((call) =>
        String(call[0]).includes("Using in-memory store"),
      ).length;

      // Reset and create new store
      resetRateLimitStore();
      await checkDistributedRateLimit("second-init", "inquiry");

      // Warning should be logged again
      const afterResetWarnCount = mockLoggerWarn.mock.calls.filter((call) =>
        String(call[0]).includes("Using in-memory store"),
      ).length;

      expect(afterResetWarnCount).toBe(initialWarnCount + 1);
    });
  });

  // =========================================================================
  // 8. Edge Cases and Boundary Tests
  // =========================================================================
  describe("edge cases and boundaries", () => {
    // 原来五条。「正好到 maxRequests 的边界」和「响应里带 resetTime」两条拆开
    // 归了两处：额度内那 10 次全部放行、成功响应带正确的 resetTime，由上面的
    // counting test 逐次钉死；第 11 次被拦时的每个字段，由
    // 「returns exact blocked metadata」钉死。那条只看被拦那一次，不管前十次。
    //
    // 「remaining 不会是负数」原来只发到额度上限就停了，根本没越过限额，也就没
    // 走到 remaining 可能变负的那段。改成发到两倍额度，才是它名字说的那件事。
    it("never reports negative remaining past the limit", async () => {
      const identifier = "negative-remaining-user";
      const max = RATE_LIMIT_PRESETS.inquiry.maxRequests;

      const remaining: number[] = [];
      for (let i = 0; i < max * 2; i++) {
        remaining.push(
          (await checkDistributedRateLimit(identifier, "inquiry")).remaining,
        );
      }

      expect(Math.min(...remaining)).toBe(0);
      expect(remaining.slice(max)).toEqual(
        Array.from({ length: max }, () => 0),
      );
    });

    // 空串和带符号的标识符原来是两条，断的是同一句话：标识符不做任何解析，
    // 拿来当 key 就是了。
    it.each([
      { name: "empty identifier", identifier: "" },
      {
        name: "identifier with email and ip punctuation",
        identifier: "user@example.com:192.168.1.1",
      },
    ])("takes any shape of identifier: $name", async ({ identifier }) => {
      const result = await checkDistributedRateLimit(identifier, "inquiry");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(RATE_LIMIT_PRESETS.inquiry.maxRequests - 1);
    });
  });

  describe("atomicity and concurrency", () => {
    // 这条原来是空转的。它 mock 的 fetch 只认 GET 和 SET，可实际实现发的是
    // `/multi-exec` 加 `["INCR", key]`，一条都对不上，于是每个请求都走进
    // storage_failure，inquiry 又是 fail-closed，十一个请求全被拦下。
    // allowedCount 恒为 0，`0 <= 10` 永远成立。换句话说，把实现改成不原子的
    // 读-改-写，它照样绿。
    //
    // 现在的 mock 按真实协议应答：INCR 在服务端一步加一，两个并发请求各自拿到
    // 不同的数。断言也改成「正好放行 max 个」——不是「不超过 max」。后者在全部
    // 被拒时同样成立，正是它当初失灵的原因。
    it("admits exactly the limit when requests arrive together", async () => {
      vi.useRealTimers();
      resetRateLimitStore();

      setEnv("UPSTASH_REDIS_REST_URL", "http://fake-redis:8080");
      setEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token");

      const max = RATE_LIMIT_PRESETS.inquiry.maxRequests;
      const counters = new Map<string, number>();
      const unknownCommands: string[] = [];
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      fetchSpy.mockImplementation(async (_url, options) => {
        const commands = JSON.parse(
          String((options as RequestInit).body),
        ) as string[][];

        const results = commands.map((command) => {
          const [name, key] = command;

          // INCR 的意义就在于取值和加一在服务端是一步完成的。这里先读后写没有
          // await 隔开，等价于同一件事。真实实现要是退回读-改-写，请求之间就会
          // 隔着网络往返，下面的并发数立刻对不上。
          if (name === "INCR") {
            const next = (counters.get(key!) ?? 0) + 1;
            counters.set(key!, next);
            return { result: next };
          }
          if (name === "PTTL") {
            return { result: MINUTE_MS };
          }
          if (name === "GET") {
            return { result: String(counters.get(key!) ?? 0) };
          }
          if (name === "PEXPIRE" || name === "SET") {
            return { result: 1 };
          }

          // 认不出的命令记下来，别默默回一个 `{ result: 1 }`。这条测试钉的是
          // INCR；哪天实现换成同样原子的 Lua EVAL，默默糊弄会让计数对不上，
          // 报错说的是「放行了 11 个」，把人往「原子性坏了」的方向带。
          //
          // 也不能在这儿直接 throw：store 有 catch，抛出去会被吞成
          // storage_failure，最后还是变成计数对不上。记下来，下面第一条就断它。
          unknownCommands.push(String(name));
          return { result: 1 };
        });

        // 上面那段 map 是同步跑完的，取值和加一之间没有 await——INCR 在服务端
        // 就是这个语义。这里 yield 一次只是让响应异步返回，像真的网络往返，
        // 并不制造竞态窗口：窗口是被测实现自己开的，实现要是把读和写拆成两次
        // 请求，中间那次 await 就会让别的请求插进来，计数立刻对不上。
        await Promise.resolve();
        return new Response(JSON.stringify(results), { status: 200 });
      });

      const results = await Promise.all(
        Array.from({ length: max + 1 }, () =>
          checkDistributedRateLimit("concurrent-redis-user", "inquiry"),
        ),
      );

      fetchSpy.mockRestore();

      // 顺序有讲究：先说清桩本身还认得实现发的命令，再说结果对不对。反过来的话，
      // 桩过期了报出来的是一串计数，看的人会先去查限流逻辑。
      expect(unknownCommands).toEqual([]);
      expect(results.filter((result) => result.allowed)).toHaveLength(max);
    });
  });
});
