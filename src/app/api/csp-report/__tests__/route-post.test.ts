import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/csp-report/route";
import { logger } from "@/lib/logger";
import { suppressExpectedCspWarnings } from "./test-utils";

/**
 * `/api/csp-report` 的 POST 行为。
 *
 * 2026-07-29 这个文件是五份 POST 测试合并来的：原来的 `route-post.test.ts`（2 条）、
 * `route-post-core.test.ts`（13 条）、`route-post-advanced.test.ts`（10 条）、
 * `route-post-security.test.ts`（9 条），外加 `route.test.ts` 里的 POST 部分（11 条）。
 * 45 条收到 12 条，同一个路由不需要五份 mock 设置和五份 `validCSPReport` 副本。
 *
 * 合并方式是把「同一个行为、不同输入」的枚举压成 `it.each` 表：拒绝矩阵、
 * 接受的 content-type、可疑模式、敌意载荷。加一种输入是加一行，不是加一个 it。
 *
 * 删掉的里面有三类不是重复：
 *
 * 1. 并发用例（10 个 POST 并行、3 个 GET 并行）：路由是无状态的，十份互不相干的
 *    请求全绿证明不了任何并发性质。
 * 2. `应该处理意外的错误` 和 `应该处理无效的JSON` 的请求体、断言逐字相同。
 * 3. `应该记录处理统计信息` 的全部断言是 `expect(console.warn).toHaveBeenCalled()`。
 *
 * 另外原来的 `应该处理大小写不敏感的content type` 名字说反了：它断言 415，
 * 也就是大小写敏感。表里按真实行为写。
 *
 * 日志断言统一走被 mock 的 `logger`，不再 spy `console.warn`：路由记的是
 * `logger.warn` / `logger.error`，直接断言它们才数得清「恰好一次」。
 */

// 限流链路（store 和 key 派生）在首次使用时会打若干条与本路由无关的启动 warn。
// 把 `withRateLimit` 换成直通，这个文件里的 `logger.warn` 就只剩路由自己写的那些，
// 可以直接断总量——只数目标消息的话，路由多写一条
// `logger.warn("Raw CSP report", cspReport)` 把未清洗的原始载荷打进日志也是绿的。
// 限流本身的集成由 `route-rate-limit.test.ts` 负责。
vi.mock("@/lib/api/with-rate-limit", () => ({
  withRateLimit:
    (
      _preset: string,
      handler: (
        request: NextRequest,
        context: { clientIP: string },
      ) => Promise<Response>,
    ) =>
    (request: NextRequest) =>
      handler(request, { clientIP: "127.0.0.1" }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
  sanitizeIP: (ip: string | undefined | null) =>
    ip ? "[REDACTED_IP]" : "[NO_IP]",
  sanitizeLogContext: (context: Record<string, unknown>) => context,
}));

const VALID_REPORT_BODY = {
  "document-uri": "https://example.com/page",
  referrer: "https://example.com",
  "violated-directive": "script-src",
  "effective-directive": "script-src",
  "original-policy": "default-src 'self'; script-src 'self'",
  disposition: "enforce",
  "blocked-uri": "https://malicious.com/script.js",
  "line-number": 42,
  "column-number": 10,
  "source-file": "https://example.com/page",
  "status-code": 200,
  "script-sample": "console.log('policy sample')",
} as const;

const validCSPReport = { "csp-report": VALID_REPORT_BODY };

function postRequest(
  body: string | null,
  headers: Record<string, string> = {
    "content-type": "application/csp-report",
  },
) {
  return new NextRequest("http://localhost:3000/api/csp-report", {
    method: "POST",
    body,
    headers,
  });
}

function postReport(
  report: unknown,
  headers?: Record<string, string>,
): Promise<Response> {
  return Promise.resolve(POST(postRequest(JSON.stringify(report), headers)));
}

function reportWith(overrides: Record<string, unknown>) {
  return { "csp-report": { ...VALID_REPORT_BODY, ...overrides } };
}

function logMessages(mocked: typeof logger.warn | typeof logger.error) {
  return vi.mocked(mocked).mock.calls.map(([first]) => first);
}

function getViolationLog(): Record<string, string> {
  const call = vi
    .mocked(logger.warn)
    .mock.calls.find(([message]) => message === "CSP Violation Report");

  if (!call) {
    throw new Error("Route did not log a CSP Violation Report");
  }

  return call[1] as Record<string, string>;
}

describe("POST /api/csp-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    suppressExpectedCspWarnings();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a valid report, logs it once, and strips URL secrets", async () => {
    const response = await postReport(
      reportWith({
        "document-uri": "https://example.com/page?token=secret#frag",
        referrer: "https://ref.example.com/path?session=123",
        "blocked-uri": "https://malicious.com/script.js?payload=1#hash",
        "source-file": "https://example.com/app.js?build=123",
        "script-sample": "x".repeat(250),
      }),
      {
        "content-type": "application/csp-report",
        "x-forwarded-for": "127.0.0.1",
      },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("received");
    expect(data.timestamp).toEqual(expect.any(String));

    // 查询串和 fragment 会把买家会话 token 带进日志，必须在记录前剥掉。
    expect(logMessages(logger.warn)).toEqual(["CSP Violation Report"]);
    expect(console.warn).not.toHaveBeenCalled();
    expect(getViolationLog()).toEqual(
      expect.objectContaining({
        documentUri: "https://example.com/page",
        referrer: "https://ref.example.com/path",
        blockedUri: "https://malicious.com/script.js",
        sourceFile: "https://example.com/app.js",
        scriptSample: "x".repeat(200),
      }),
    );
    expect(vi.mocked(logger.error)).not.toHaveBeenCalled();
  });

  // 这些字段全是攻击者可控的。换行进日志等于伪造日志行；不封顶等于让一次报告
  // 撑爆一条日志记录。长度上限本身就是合同，所以断言精确长度而不是「不超过」。
  it("bounds and de-newlines every attacker-controlled log field", async () => {
    const longValue = `before\nmiddle\rend\tline\u2028separator\u2029${"x".repeat(600)}`;
    const invalidUrlValue = `notaurl\nforged\tline\u2028${"u".repeat(600)}?token=secret#frag`;

    const response = await postReport(
      reportWith({
        "document-uri": invalidUrlValue,
        referrer: invalidUrlValue,
        "violated-directive": longValue,
        "effective-directive": longValue,
        "original-policy": longValue,
        disposition: longValue,
        "blocked-uri": invalidUrlValue,
        "source-file": invalidUrlValue,
        "script-sample": longValue,
      }),
      {
        "content-type": "application/csp-report",
        "user-agent": `TestBrowser/${"x".repeat(600)}`,
      },
    );

    expect(response.status).toBe(200);

    const log = getViolationLog();
    const expectedLengths = {
      documentUri: 500,
      referrer: 500,
      originalPolicy: 500,
      blockedUri: 500,
      sourceFile: 500,
      violatedDirective: 200,
      effectiveDirective: 200,
      scriptSample: 200,
      disposition: 200,
      userAgent: 200,
    } as const;

    for (const [field, length] of Object.entries(expectedLengths)) {
      expect(log[field]).toHaveLength(length);
      expect(log[field]).not.toMatch(/[\r\n\t\u2028\u2029]/u);
    }
  });

  it("redacts the client IP but keeps the user agent", async () => {
    await postReport(validCSPReport, {
      "content-type": "application/csp-report",
      "x-forwarded-for": "203.0.113.1, 192.168.1.1",
      "user-agent": "Mozilla/5.0 (Test Browser)",
      referer: "https://example.com/source",
    });

    expect(getViolationLog()).toEqual(
      expect.objectContaining({
        ip: "[REDACTED_IP]",
        userAgent: "Mozilla/5.0 (Test Browser)",
      }),
    );
  });

  // 每一行都是一种「不该被当成有效报告」的输入。errorCode 是浏览器和运维看到的
  // 稳定标识，所以连状态码一起钉。
  it.each([
    [
      "content-type 不在允许列表里",
      JSON.stringify(validCSPReport),
      { "content-type": "text/plain" },
      415,
      "UNSUPPORTED_MEDIA_TYPE",
    ],
    [
      "完全没有 content-type",
      JSON.stringify(validCSPReport),
      {},
      415,
      "UNSUPPORTED_MEDIA_TYPE",
    ],
    [
      "content-type 大小写不匹配（匹配是大小写敏感的）",
      JSON.stringify(validCSPReport),
      { "content-type": "APPLICATION/CSP-REPORT" },
      415,
      "UNSUPPORTED_MEDIA_TYPE",
    ],
    [
      "请求体不是合法 JSON",
      "invalid-json",
      { "content-type": "application/csp-report" },
      400,
      "INVALID_JSON_BODY",
    ],
    [
      "请求体为空字符串",
      "",
      { "content-type": "application/csp-report" },
      400,
      "INVALID_REQUEST",
    ],
    // 空字符串和 null 在 fetch 里不是同一种 body 初始化，分开各占一行，免得
    // 「两者其实走同一个分支」这个假设哪天悄悄不成立。
    [
      "请求体是 null",
      null,
      { "content-type": "application/csp-report" },
      400,
      "INVALID_REQUEST",
    ],
    [
      "顶层没有 csp-report 字段",
      JSON.stringify({ "not-csp-report": {} }),
      { "content-type": "application/csp-report" },
      400,
      "INVALID_REQUEST",
    ],
  ])(
    "rejects a report whose %s",
    async (_case, body, headers, status, errorCode) => {
      const response = await POST(postRequest(body, headers));
      const data = await response.json();

      expect(response.status).toBe(status);
      expect(data.errorCode).toBe(errorCode);
    },
  );

  it("rejects null in the core string fields", async () => {
    const response = await postReport(
      reportWith({ "blocked-uri": null, "script-sample": null }),
    );

    expect(response.status).toBe(400);
  });

  it.each([
    ["application/csp-report", "application/csp-report"],
    ["application/json", "application/json"],
    ["带 charset 的", "application/csp-report; charset=utf-8"],
  ])("accepts the %s content type", async (_label, contentType) => {
    const response = await postReport(validCSPReport, {
      "content-type": contentType,
    });

    expect(response.status).toBe(200);
  });

  // 空的 csp-report 对象是真实浏览器会发的东西。它没有内容可记，但也不是客户端
  // 出错，所以是 204 而不是 400。
  it("acknowledges an empty csp-report object with 204", async () => {
    const response = await postReport({ "csp-report": {} });

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
  });

  // 现代的 report-to / Reporting-Endpoints 通道发的是数组，字段是 camelCase，
  // content-type 是 application/reports+json。它必须解析成 2xx，不能 400。
  it("parses a Reporting API batch and logs the csp-violation entry", async () => {
    const response = await postReport(
      [
        {
          type: "csp-violation",
          age: 10,
          url: "https://example.com/page",
          user_agent: "Mozilla/5.0",
          body: {
            documentURL: "https://example.com/page",
            referrer: "https://example.com",
            blockedURL: "https://malicious.com/script.js",
            effectiveDirective: "script-src",
            violatedDirective: "script-src",
            originalPolicy: "default-src 'self'; script-src 'self'",
            disposition: "enforce",
            statusCode: 200,
            sourceFile: "https://example.com/page",
            lineNumber: 42,
            columnNumber: 10,
            sample: "console.log('reporting sample')",
          },
        },
      ],
      { "content-type": "application/reports+json" },
    );

    expect(response.status).toBe(200);
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      "CSP Violation Report",
      expect.any(Object),
    );
  });

  it("accepts the 20-report batch limit and logs each violation once", async () => {
    const report = {
      type: "csp-violation",
      body: {
        documentURL: "https://example.com/page",
        blockedURL: "https://malicious.com/script.js",
        effectiveDirective: "script-src",
      },
    };

    const response = await postReport(
      Array.from({ length: 20 }, () => report),
      {
        "content-type": "application/reports+json",
      },
    );

    expect(response.status).toBe(200);
    expect(logMessages(logger.warn)).toEqual(
      Array.from({ length: 20 }, () => "CSP Violation Report"),
    );
  });

  it("rejects an oversized Reporting API batch before per-report logging", async () => {
    const report = {
      type: "csp-violation",
      body: {
        documentURL: "https://example.com/page",
        blockedURL: "https://malicious.com/script.js",
        effectiveDirective: "script-src",
      },
    };

    const response = await postReport(
      Array.from({ length: 21 }, () => report),
      {
        "content-type": "application/reports+json",
      },
    );
    const data = await response.json();

    expect(response.status).toBe(413);
    expect(data.errorCode).toBe("PAYLOAD_TOO_LARGE");
    expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
    expect(vi.mocked(logger.error)).not.toHaveBeenCalled();
  });

  // 尽力而为的遥测：认不出的报告类型要静默忽略，不能给浏览器回 4xx。
  it("ignores non-csp-violation entries in a Reporting API batch", async () => {
    const response = await postReport(
      [
        {
          type: "deprecation",
          url: "https://example.com/page",
          body: { id: "SomeDeprecation", message: "deprecated" },
        },
      ],
      { "content-type": "application/reports+json" },
    );

    expect(response.status).toBe(204);
  });

  // 可疑报告走 error 一次、不再走 warn；普通报告走 warn 一次、不走 error。两边都要
  // 断「不走另一条」——只断「走了」的话，同时写两条日志也是绿的，而那会让告警
  // 噪音翻倍，也会让「可疑」这个信号失去意义。
  it.each([
    [
      "eval 出现在 script-sample",
      { "script-sample": 'eval("dangerous code")' },
    ],
    [
      // 载荷里不能出现 eval，否则这一行就算 data:text/html 从判定里被删掉也还是红的，
      // 名字声称守的东西其实没守住。
      "data:text/html 的内联文档",
      { "blocked-uri": "data:text/html,<p>blocked</p>" },
    ],
    ["vbscript: 协议", { "blocked-uri": "vbscript:msgbox(1)" }],
    ["onload 事件处理器", { "script-sample": "some content with onload" }],
    ["onerror 事件处理器", { "blocked-uri": "https://x.test/#onerror=1" }],
    ["onclick 事件处理器", { "script-sample": "some content with onclick" }],
  ])(
    "escalates a report with %s to a single error log",
    async (_case, overrides) => {
      const response = await postReport(reportWith(overrides));

      expect(response.status).toBe(200);
      expect(logMessages(logger.error)).toEqual([
        "SUSPICIOUS CSP VIOLATION DETECTED",
      ]);
      expect(logMessages(logger.warn)).toEqual([]);
      // 只数「记了一次」的话，`logger.error("SUSPICIOUS...", {})` 也是绿的，
      // 而那条告警没有任何定位信息，运维看到也查不下去。
      expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
        "SUSPICIOUS CSP VIOLATION DETECTED",
        expect.objectContaining({
          timestamp: expect.any(String),
          blockedUri: expect.any(String),
          scriptSample: expect.any(String),
          ip: "[REDACTED_IP]",
        }),
      );
    },
  );

  // 这些输入没有一种应该让路由抛异常或回 5xx。端点从不信任载荷内容，所以正确行为
  // 是收下（记录时再清洗），只有超过体积上限时才拒。
  it.each([
    [
      "特殊字符与 XSS 尝试",
      {
        "blocked-uri": "https://x.test/<>&\"'",
        "script-sample": '"><script>alert("xss")</script>',
      },
      200,
    ],
    [
      "Unicode 域名与路径",
      {
        "document-uri": "https://测试.com/页面",
        "blocked-uri": "https://恶意.com/脚本.js",
      },
      200,
    ],
    [
      "SQL 注入形状",
      {
        "blocked-uri": "https://example.com/script.js'; DROP TABLE users; --",
        "script-sample": "1' OR '1'='1",
      },
      200,
    ],
    ["NoSQL 注入形状", { "script-sample": '{"$ne": null}' }, 200],
    [
      "命令注入形状",
      { "blocked-uri": "https://example.com/script.js; rm -rf /" },
      200,
    ],
    [
      "深度嵌套的额外字段",
      { "extra-field": { a: { b: { c: { d: { e: "deep" } } } } } },
      200,
    ],
    [
      "越界的数字字段",
      { "line-number": 0, "column-number": -1, "status-code": 999 },
      200,
    ],
    ["布尔额外字段", { "is-enforced": true, "is-report-only": false }, 200],
    [
      "数组额外字段",
      { "violated-directives": ["script-src", "style-src"] },
      200,
    ],
    // 250 和 50000 之间要留一个点：只有两端的话，把 sample 上限收成 800 字符
    // 这种改动两头都不会红。
    [
      "刚好在上限内的 1000 字符 sample",
      { "script-sample": "x".repeat(1000) },
      200,
    ],
    ["超过体积上限的巨大载荷", { "script-sample": "x".repeat(50_000) }, 413],
  ])("survives a hostile payload with %s", async (_case, overrides, status) => {
    const response = await postReport(reportWith(overrides));

    expect(response.status).toBe(status);
  });

  // 生产环境 + 配好 CSP_REPORT_URI 是真正会上线的那条路径，必须单独走一遍：只在
  // 默认测试环境验证可疑告警的话，一句 `if (isRuntimeProduction()) return ignored`
  // 或者把生产的 error 降级成 warn，其余用例全都不会红，而线上告警已经没了。
  it("still escalates suspicious reports in production", async () => {
    vi.doMock("@/lib/env", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/env")>();
      const env = {
        ...actual.env,
        NODE_ENV: "production",
        CSP_REPORT_URI: "https://example.com/csp-report",
      };

      return { ...actual, env, runtimeEnv: env };
    });
    vi.resetModules();

    const { POST: prodPost } = await import("../route");
    const response = await prodPost(
      postRequest(
        JSON.stringify(
          reportWith({ "script-sample": 'eval("production sample")' }),
        ),
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).not.toBe("ignored");
    expect(logMessages(logger.error)).toEqual([
      "SUSPICIOUS CSP VIOLATION DETECTED",
    ]);

    vi.doUnmock("@/lib/env");
    vi.resetModules();
  });

  // 开发环境没配 CSP_REPORT_URI 时，路由该明说自己丢弃了报告，而不是假装收下。
  it("reports itself as ignoring violations when no report URI is configured", async () => {
    vi.doMock("@/lib/env", () => {
      const env = { NODE_ENV: "development", CSP_REPORT_URI: undefined };

      return {
        env,
        runtimeEnv: env,
        isRuntimeProduction: () => false,
        getRuntimeEnvString: (key: string) => {
          if (key === "NODE_ENV") return "development";
          if (key === "NEXT_PUBLIC_BASE_URL") return "http://localhost:3000";
          return undefined;
        },
      };
    });
    vi.resetModules();

    const { POST: devPost } = await import("../route");
    const response = await devPost(postRequest(JSON.stringify(validCSPReport)));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ignored");

    vi.doUnmock("@/lib/env");
    vi.resetModules();
  });
});
