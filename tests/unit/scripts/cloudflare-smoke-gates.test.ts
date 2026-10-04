import { afterEach, describe, expect, it, vi } from "vitest";
import { captureExpectedConsoleErrors } from "@/test/console";
import {
  runCloudflarePreviewSmoke,
  runDeployedSmoke,
} from "../../../scripts/quality/checks/cloudflare-smoke.js";

const HEALTHY_HTML = `<!doctype html><html><body>${"healthy page".repeat(100)}</body></html>`;
const MISSING_OFFERING_PATH = "/products/__smoke-missing-offering__";
const CORE_PUBLIC_PAGE_PATHS = [
  "/",
  "/products",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
];

const SECURITY_HEADERS = {
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy": "default-src 'self'",
};

function response(
  status: number,
  body = "ok",
  headers: HeadersInit = {},
): Response {
  return new Response(body, { status, headers });
}

function getRequestPath(input: RequestInfo | URL): string {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  return new URL(url).pathname;
}

// 两条 lane 都健康时的响应；每个用例只改动自己瞄准的那一条路由。
function createHealthyFetchMock() {
  return vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const pathname = getRequestPath(input);

      if (CORE_PUBLIC_PAGE_PATHS.includes(pathname)) {
        return response(200, HEALTHY_HTML, {
          "content-type": "text/html; charset=utf-8",
          ...SECURITY_HEADERS,
        });
      }

      if (pathname === MISSING_OFFERING_PATH) {
        return response(404, HEALTHY_HTML, {
          "content-type": "text/html; charset=utf-8",
          ...SECURITY_HEADERS,
        });
      }

      if (pathname === "/api/health") {
        return response(200, '{"status":"ok"}', {
          "content-type": "application/json",
          "cache-control": "no-store",
        });
      }

      if (pathname === "/.well-known/security.txt") {
        return response(200, "ok", { "content-type": "text/plain" });
      }

      if (pathname === "/security-policy.txt") {
        return response(404, "not found", { "content-type": "text/plain" });
      }

      if (pathname === "/api/inquiry") {
        return response(init?.method === "POST" ? 415 : 405);
      }

      return response(404, "not found");
    },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// preview 与 deployed 两条 lane 共用 evaluateProbe；这里在两条 runner 上
// 各证明一次：状态码不符、缺安全头、安全头值无效或被覆盖都会让冒烟失败。
const GATE_LANES = [
  {
    name: "cloudflare preview smoke",
    logTag: "[cf-preview-smoke]",
    createFetchMock: createHealthyFetchMock,
    run: () =>
      runCloudflarePreviewSmoke(["--base-url", "https://preview.example"]),
  },
  {
    name: "deployed smoke",
    logTag: "[post-deploy-smoke]",
    createFetchMock: createHealthyFetchMock,
    run: () =>
      runDeployedSmoke([
        "--base-url",
        "https://deployed.example",
        "--header-name",
        "x-smoke-secret",
        "--header-value",
        "proof",
      ]),
  },
] as const;

function stubRouteResponse(
  lane: (typeof GATE_LANES)[number],
  pathname: string,
  status: number,
  headers: Record<string, string>,
) {
  const baseFetchMock = lane.createFetchMock();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      getRequestPath(input) === pathname
        ? response(status, HEALTHY_HTML, {
            "content-type": "text/html; charset=utf-8",
            ...headers,
          })
        : baseFetchMock(input, init),
    ),
  );
}

describe.each(GATE_LANES)("$name gate failures", (lane) => {
  it.each([
    [
      "an expected-200 page returns 404",
      "/contact",
      404,
      "Expected /contact to return 200, got 404",
    ],
    [
      "the missing-offering route returns 200",
      MISSING_OFFERING_PATH,
      200,
      `Expected ${MISSING_OFFERING_PATH} to return 404, got 200`,
    ],
  ])("fails when %s", async (_case, pathname, status, expectedFailure) => {
    const consoleError = captureExpectedConsoleErrors(
      `${lane.logTag} Failures detected:`,
      "  - ",
    );
    stubRouteResponse(lane, pathname, status, SECURITY_HEADERS);

    await expect(lane.run()).resolves.toBe(false);
    expect(consoleError.mock.calls).toEqual([
      [`${lane.logTag} Failures detected:`],
      [`  - ${expectedFailure}`],
    ]);
  });

  it.each([
    ["x-frame-options", "DENY"],
    ["x-content-type-options", "nosniff"],
    ["referrer-policy", "strict-origin-when-cross-origin"],
  ])("fails when %s is missing", async (headerName, expected) => {
    const consoleError = captureExpectedConsoleErrors(
      `${lane.logTag} Failures detected:`,
      "  - ",
    );
    const headers: Record<string, string> = { ...SECURITY_HEADERS };
    delete headers[headerName];
    stubRouteResponse(lane, "/contact", 200, headers);

    await expect(lane.run()).resolves.toBe(false);
    expect(consoleError.mock.calls).toEqual([
      [`${lane.logTag} Failures detected:`],
      [`  - Expected /contact to carry ${headerName}: ${expected}, got none`],
    ]);
  });

  it.each([
    ["x-content-type-options", "not-nosniff", "nosniff"],
    ["x-content-type-options", "nosniff, nosniff", "nosniff"],
    ["x-frame-options", "NOT-DENY", "DENY"],
    ["x-frame-options", "SAMEORIGIN", "DENY"],
    [
      "referrer-policy",
      "strict-origin-when-cross-origin, unsafe-url",
      "strict-origin-when-cross-origin",
    ],
    [
      "referrer-policy",
      "no-strict-origin-when-cross-origin",
      "strict-origin-when-cross-origin",
    ],
    ["referrer-policy", "not-a-policy", "strict-origin-when-cross-origin"],
  ])(
    "fails when %s is %j (invalid or overridden)",
    async (headerName, value, expected) => {
      const consoleError = captureExpectedConsoleErrors(
        `${lane.logTag} Failures detected:`,
        "  - ",
      );
      stubRouteResponse(lane, "/contact", 200, {
        ...SECURITY_HEADERS,
        [headerName]: value,
      });

      await expect(lane.run()).resolves.toBe(false);
      expect(consoleError.mock.calls).toEqual([
        [`${lane.logTag} Failures detected:`],
        [
          `  - Expected /contact to carry ${headerName}: ${expected}, got ${value}`,
        ],
      ]);
    },
  );

  it.each([
    ["x-content-type-options", " NoSniff "],
    ["x-frame-options", "deny"],
    ["referrer-policy", "unsafe-url, strict-origin-when-cross-origin"],
    ["referrer-policy", "strict-origin-when-cross-origin, future-policy"],
  ])("accepts %s %j as the effective policy", async (headerName, value) => {
    stubRouteResponse(lane, "/contact", 200, {
      ...SECURITY_HEADERS,
      [headerName]: value,
    });

    await expect(lane.run()).resolves.toBe(true);
  });
});
