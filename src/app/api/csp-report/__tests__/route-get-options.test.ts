import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, OPTIONS } from "@/app/api/csp-report/route";
import { suppressExpectedCspWarnings } from "./test-utils";

/**
 * `/api/csp-report` 的 GET 与 OPTIONS。
 *
 * 2026-07-29 从 21 条收到 3 条。这两个方法各自只有一段十几行的实现，原来却被拆成
 * 六个 describe 反复断言同一件事：
 *
 * - GET 的健康检查载荷：`返回健康检查信息`、`返回正确的响应格式`、
 *   `设置正确的Content-Type`、`处理多次调用`、`GET响应应该包含必要字段`、
 *   `GET请求应该返回200状态码`、`并发GET请求`——七条，加上 `route.test.ts` 里
 *   还有一条，共八条。
 * - OPTIONS 的预检响应头：`允许的来源返回共享CORS headers`、`返回空的响应体`、
 *   `处理预检请求`、`支持多种HTTP方法`、`OPTIONS响应应该包含正确的头部`、
 *   `OPTIONS请求应该返回200状态码`、`并发OPTIONS请求`——七条，同样在
 *   `route.test.ts` 里还有一份。
 *
 * 「并发」那两条是 `Promise.all` 三个互不相干的请求，路由无状态，证明不了任何
 * 并发性质。「处理多次调用」同理。
 *
 * 原来的 `错误处理` 和 `HTTP状态码验证` 两个 describe 测的全是 POST 的拒绝路径，
 * 已经合并进 `route-post.test.ts` 的拒绝矩阵表。
 */

function createOptionsRequest(origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/csp-report", {
    method: "OPTIONS",
    headers: {
      origin,
      host: "localhost:3000",
    },
  });
}

describe("GET and OPTIONS /api/csp-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    suppressExpectedCspWarnings();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("answers GET with a health payload", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(data.status).toBe("CSP report endpoint active");
    // toBeDefined() 放行 `Date.now()` 这种数字：健康探针的时间戳合同是 ISO 字符串。
    expect(data.timestamp).toEqual(expect.any(String));
  });

  it("answers a preflight from an allowed origin with the full CORS set", async () => {
    const response = await OPTIONS(createOptionsRequest());
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Allow")).toBe("POST, GET, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3000",
    );
    expect(
      response.headers
        .get("Access-Control-Allow-Methods")
        ?.split(",")
        .map((method) => method.trim())
        .sort(),
    ).toEqual(["GET", "OPTIONS", "POST"]);
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
      "Content-Type",
    );
    expect(body).toBe("");
  });

  // 关键是「不回 Access-Control-Allow-Origin」，而不是「回了 204」：回 204 但带上
  // 允许来源头，等于把这个端点开放给任意站点。
  it("refuses a preflight from an unlisted origin without echoing it back", async () => {
    const response = await OPTIONS(createOptionsRequest("https://evil.test"));
    const body = await response.text();

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(body).toBe("");
  });
});
