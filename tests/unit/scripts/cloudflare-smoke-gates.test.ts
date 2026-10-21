import { afterEach, describe, expect, it, vi } from "vitest";
import { captureExpectedConsoleErrors } from "@/test/console";
import {
  CORE_PUBLIC_PAGE_PATHS,
  runCloudflarePreviewSmoke,
  runDeployedSmoke,
} from "../../../scripts/quality/checks/cloudflare-smoke.js";

// 注册表推导出的字面量元组放宽为 string，便于判断任意请求路径。
const PAGE_PATHS: readonly string[] = CORE_PUBLIC_PAGE_PATHS;
const HEALTHY_HTML = `<!doctype html><html><body>${"healthy page".repeat(100)}</body></html>`;
const MISSING_OFFERING_PATH = "/products/__smoke-missing-offering__";

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

      if (PAGE_PATHS.includes(pathname)) {
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
    [
      "referrer-policy",
      "unsafe-url, STRICT-ORIGIN-WHEN-CROSS-ORIGIN",
      "strict-origin-when-cross-origin",
    ],
    [
      "referrer-policy",
      "strict-origin-when-cross-origin, UNSAFE-URL",
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

// production lane 额外核对 robots.txt 与首页 noindex；fixture 取自模板的真实输出
// 和 Cloudflare 托管 robots.txt 文档里前置的屏蔽块。
const TEMPLATE_ROBOTS = `User-Agent: *
Allow: /
Disallow: /api/

Sitemap: https://deployed.example/sitemap.xml
`;
const NON_PRODUCTION_ROBOTS = `User-Agent: *
Disallow: /

Sitemap: https://deployed.example/sitemap.xml
`;
const CLOUDFLARE_TRAINING_BLOCK = `# BEGIN Cloudflare Managed content

User-Agent: *
Content-signal: search=yes,ai-train=no
Allow: /

${[
  "Amazonbot",
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
  "ClaudeBot",
  "Google-Extended",
  "GPTBot",
  "meta-externalagent",
]
  .map((agent) => `User-agent: ${agent}\nDisallow: /\n`)
  .join("\n")}
# END Cloudflare Managed Content

`;

function stubProductionSite(robotsBody: string, homeHeaders = {}) {
  const baseFetchMock = createHealthyFetchMock();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const pathname = getRequestPath(input);
      if (pathname === "/robots.txt") {
        return response(200, robotsBody, { "content-type": "text/plain" });
      }
      if (pathname === "/") {
        return response(200, HEALTHY_HTML, {
          "content-type": "text/html; charset=utf-8",
          ...SECURITY_HEADERS,
          ...homeHeaders,
        });
      }
      return baseFetchMock(input, init);
    }),
  );
}

const runProductionDeployedSmoke = () =>
  runDeployedSmoke(["--base-url", "https://deployed.example"]);

describe("deployed smoke production indexing gate", () => {
  it.each([
    ["the template robots.txt", TEMPLATE_ROBOTS],
    [
      "Cloudflare prepends blocks for training crawlers only",
      CLOUDFLARE_TRAINING_BLOCK + TEMPLATE_ROBOTS,
    ],
    // 尾部 `*` 不增加特异性：`/*` 与 `/` 等长，等长时 Allow 胜出。
    [
      "an equally specific Allow: / beside Disallow: /*",
      `User-agent: Googlebot\nAllow: /\nDisallow: /*\n\n${TEMPLATE_ROBOTS}`,
    ],
  ])("passes with %s", async (_case, robotsBody) => {
    vi.stubEnv("APP_ENV", "production");
    stubProductionSite(robotsBody);

    await expect(runProductionDeployedSmoke()).resolves.toBe(true);
  });

  it.each([
    [
      "the * group disallows /",
      NON_PRODUCTION_ROBOTS,
      "*, OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Googlebot, Bingbot",
    ],
    [
      "a shared group blocks OAI-SearchBot (case-insensitive)",
      `User-agent: GPTBot\nuser-agent: oai-searchbot\nDisallow: /\n\n${TEMPLATE_ROBOTS}`,
      "OAI-SearchBot",
    ],
    [
      "Cloudflare also blocks PerplexityBot",
      `${CLOUDFLARE_TRAINING_BLOCK}User-agent: PerplexityBot\nDisallow: /\n\n${TEMPLATE_ROBOTS}`,
      "PerplexityBot",
    ],
    [
      "Googlebot's own group overrides the * allow",
      `User-agent: Googlebot\nDisallow: /\n\n${TEMPLATE_ROBOTS}`,
      "Googlebot",
    ],
    // RFC 9309 的换行可以是单独的 CR。
    [
      "the * group disallows / with CR-only line breaks",
      "User-agent: *\rDisallow: /\r",
      "*, OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Googlebot, Bingbot",
    ],
    // Google 把 `googlebot*`、`googlebot/2.1` 视同 googlebot。
    [
      "a Googlebot* group disallows /",
      `User-agent: Googlebot*\nDisallow: /\n\n${TEMPLATE_ROBOTS}`,
      "Googlebot",
    ],
    [
      "a Googlebot/2.1 group disallows /",
      `User-agent: Googlebot/2.1\nDisallow: /\n\n${TEMPLATE_ROBOTS}`,
      "Googlebot",
    ],
  ])("fails when %s", async (_case, robotsBody, blockedAgents) => {
    vi.stubEnv("APP_ENV", "production");
    const consoleError = captureExpectedConsoleErrors(
      "[post-deploy-smoke] Failures detected:",
      "  - ",
    );
    stubProductionSite(robotsBody);

    await expect(runProductionDeployedSmoke()).resolves.toBe(false);
    expect(consoleError.mock.calls).toEqual([
      ["[post-deploy-smoke] Failures detected:"],
      [
        `  - Expected /robots.txt to allow / for search and agent crawlers; disallowed for: ${blockedAgents}`,
      ],
    ]);
  });

  it("fails when / carries X-Robots-Tag noindex", async () => {
    vi.stubEnv("APP_ENV", "production");
    const consoleError = captureExpectedConsoleErrors(
      "[post-deploy-smoke] Failures detected:",
      "  - ",
    );
    stubProductionSite(TEMPLATE_ROBOTS, {
      "x-robots-tag": "noindex, nofollow",
    });

    await expect(runProductionDeployedSmoke()).resolves.toBe(false);
    expect(consoleError.mock.calls).toEqual([
      ["[post-deploy-smoke] Failures detected:"],
      ["  - Expected / to be indexable, got X-Robots-Tag: noindex, nofollow"],
    ]);
  });

  // preview proof 也跑 deployed-smoke，而非 production 构建本来就禁止抓取。
  it("does not apply outside the production lane", async () => {
    vi.stubEnv("APP_ENV", "preview");
    stubProductionSite(NON_PRODUCTION_ROBOTS, {
      "x-robots-tag": "noindex, nofollow",
    });

    await expect(runProductionDeployedSmoke()).resolves.toBe(true);
  });
});
