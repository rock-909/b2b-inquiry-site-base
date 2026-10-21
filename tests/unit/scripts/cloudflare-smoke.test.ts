import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureExpectedConsoleErrors } from "@/test/console";
import {
  CORE_PUBLIC_PAGE_PATHS,
  runCloudflarePreviewSmoke,
  runDeployedSmoke,
  runExternalUrlSmoke,
} from "../../../scripts/quality/checks/cloudflare-smoke.js";

// 注册表推导出的字面量元组放宽为 string，便于判断任意请求路径。
const PAGE_PATHS: readonly string[] = CORE_PUBLIC_PAGE_PATHS;
const RETRIABLE_TIMEOUT_ERROR = new DOMException(
  "request timed out",
  "TimeoutError",
);

const openServers: http.Server[] = [];
const FIXTURE_PREFIX = "b2b-minimal-cloudflare-smoke-";
const HEALTHY_HTML = `<!doctype html><html><body>${"healthy page".repeat(100)}</body></html>`;
const MISSING_OFFERING_PATH = "/products/__smoke-missing-offering__";
const DEPLOYED_SMOKE_PATHS = [
  ...CORE_PUBLIC_PAGE_PATHS,
  MISSING_OFFERING_PATH,
  "/api/health",
  "/.well-known/security.txt",
  "/security-policy.txt",
  "/api/inquiry",
];

interface ChildProcessResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

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

function createPreviewFetchMock() {
  return vi.fn(
    async (
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ): Promise<Response> => {
      const pathname = getRequestPath(_input);

      if (PAGE_PATHS.includes(pathname)) {
        const headers = new Headers({
          "content-type": "text/html; charset=utf-8",
          ...SECURITY_HEADERS,
        });
        return response(200, HEALTHY_HTML, headers);
      }

      if (pathname === "/api/health") {
        return response(200, '{"status":"ok"}', {
          "content-type": "application/json",
          "cache-control": "no-store",
        });
      }

      return response(404, HEALTHY_HTML, {
        "content-type": "text/html; charset=utf-8",
        ...SECURITY_HEADERS,
      });
    },
  );
}

function createDeployedFetchMock() {
  return vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const pathname = getRequestPath(input);
      const headers = init?.headers as Record<string, string> | undefined;

      if (headers?.["x-smoke-secret"] !== "proof") {
        return response(401, "missing proof header");
      }

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

      if (["/api/health", "/.well-known/security.txt"].includes(pathname)) {
        return response(200, "ok", {
          "content-type": "text/plain",
          ...(pathname === "/api/health"
            ? { "cache-control": "no-store" }
            : {}),
        });
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

function listenForExternalUrlSmoke(): Promise<{
  baseUrl: string;
  paths: string[];
}> {
  return new Promise((resolve, reject) => {
    const paths: string[] = [];
    const server = http.createServer((request, serverResponse) => {
      const pathname = request.url ?? "/";
      paths.push(pathname);

      if (PAGE_PATHS.includes(pathname)) {
        serverResponse.writeHead(200, { "content-type": "text/plain" });
        serverResponse.end("ok");
        return;
      }

      serverResponse.writeHead(404);
      serverResponse.end("not found");
    });

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("Expected TCP server address"));
        return;
      }

      openServers.push(server);
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        paths,
      });
    });
  });
}

function listenForDeployedSmoke(): Promise<{
  baseUrl: string;
  paths: string[];
}> {
  return new Promise((resolve, reject) => {
    const paths: string[] = [];
    const server = http.createServer((request, serverResponse) => {
      const pathname = request.url ?? "/";
      paths.push(pathname);

      if (PAGE_PATHS.includes(pathname)) {
        serverResponse.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          ...SECURITY_HEADERS,
        });
        serverResponse.end(HEALTHY_HTML);
        return;
      }

      if (pathname === MISSING_OFFERING_PATH) {
        serverResponse.writeHead(404, {
          "content-type": "text/html; charset=utf-8",
          ...SECURITY_HEADERS,
        });
        serverResponse.end(HEALTHY_HTML);
        return;
      }

      if (["/api/health", "/.well-known/security.txt"].includes(pathname)) {
        serverResponse.writeHead(200, {
          "content-type": "text/plain",
          ...(pathname === "/api/health"
            ? { "cache-control": "no-store" }
            : {}),
        });
        serverResponse.end("ok");
        return;
      }

      if (pathname === "/security-policy.txt") {
        serverResponse.writeHead(404, { "content-type": "text/plain" });
        serverResponse.end("not found");
        return;
      }

      serverResponse.writeHead(
        pathname === "/api/inquiry" && request.method === "POST" ? 415 : 404,
      );
      serverResponse.end("not found");
    });

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("Expected TCP server address"));
        return;
      }

      openServers.push(server);
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        paths,
      });
    });
  });
}

function createMinimalCloudflareSmokeFixture(): string {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), FIXTURE_PREFIX));
  // 部署冒烟作业没有 node_modules，只需要脚本本身、同目录的产物检查、收录检查和页面注册表。
  for (const repoPath of [
    "scripts/quality/checks/cloudflare-smoke.js",
    "scripts/quality/checks/cloudflare-artifact-config.js",
    "scripts/quality/checks/robots-indexing.js",
    "src/config/pages.config.ts",
  ]) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temp path created above
    mkdirSync(path.dirname(path.join(rootDir, repoPath)), { recursive: true });
    copyFileSync(path.resolve(repoPath), path.join(rootDir, repoPath));
  }
  return rootDir;
}

function runNodeCommand(
  args: string[],
  cwd = process.cwd(),
): Promise<ChildProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });
    child.once("error", reject);
    child.once("close", (status) => {
      resolve({
        status,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
      });
    });
  });
}

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();

  const servers = openServers.splice(0);
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
});

describe("external URL smoke", () => {
  it("runs external-url-smoke through the direct CLI", async () => {
    const { baseUrl, paths } = await listenForExternalUrlSmoke();

    const result = await runNodeCommand([
      "scripts/quality/checks/cloudflare-smoke.js",
      "external-url-smoke",
      "--base-url",
      baseUrl,
    ]);

    expect(result.status).toBe(0);
    expect(paths).toEqual([...CORE_PUBLIC_PAGE_PATHS]);
    expect(result.stdout).toContain("[external-url-smoke] All checks passed");
  });
});

describe("cloudflare preview smoke", () => {
  it("rejects the smoke run when a hung request is aborted", async () => {
    const controller = new AbortController();
    const timeoutError = new DOMException("request timed out", "TimeoutError");
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(controller.signal);

    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(init.signal?.reason),
              { once: true },
            );
          }),
      ),
    );

    const smoke = runCloudflarePreviewSmoke([
      "--base-url",
      "https://preview.example",
    ]);
    controller.abort(timeoutError);

    const outcome = await Promise.race([
      smoke.then(
        () => ({ status: "resolved" as const }),
        (reason: unknown) => ({ reason, status: "rejected" as const }),
      ),
      new Promise<{ status: "pending" }>((resolve) => {
        setImmediate(() => resolve({ status: "pending" }));
      }),
    ]);

    expect(outcome).toEqual({ reason: timeoutError, status: "rejected" });
    expect(timeoutSpy).toHaveBeenCalledWith(30000);
  });

  it("starts every route in a smoke round before the first response settles", async () => {
    const expectedPaths = [
      ...CORE_PUBLIC_PAGE_PATHS,
      MISSING_OFFERING_PATH,
      "/api/health",
    ];
    let releaseRoot!: () => void;
    const started: string[] = [];
    const previewFetchMock = createPreviewFetchMock();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const pathname = getRequestPath(input);
        started.push(pathname);

        if (pathname === "/") {
          return new Promise<Response>((resolve) => {
            releaseRoot = () =>
              resolve(
                response(200, HEALTHY_HTML, {
                  "content-type": "text/html; charset=utf-8",
                  ...SECURITY_HEADERS,
                }),
              );
          });
        }

        return previewFetchMock(input, init);
      }),
    );

    const proof = runCloudflarePreviewSmoke([
      "--base-url",
      "https://preview.example",
      "--include-api-health",
      "--rounds",
      "1",
    ]);

    await vi.waitFor(() => {
      expect(started).toEqual(expectedPaths);
    });

    releaseRoot();
    await expect(proof).resolves.toBe(true);
  });

  it.each(["0", "1.5"])("rejects invalid round count %s", async (rounds) => {
    await expect(
      runCloudflarePreviewSmoke([
        "--base-url",
        "https://preview.example",
        "--rounds",
        rounds,
      ]),
    ).rejects.toThrow("--rounds must be a positive integer");
  });

  it("runs every preview route for each requested round", async () => {
    const fetchMock = createPreviewFetchMock();
    const expectedRound = [
      ...CORE_PUBLIC_PAGE_PATHS,
      MISSING_OFFERING_PATH,
      "/api/health",
    ];
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      runCloudflarePreviewSmoke([
        "--base-url",
        "https://preview.example",
        "--include-api-health",
        "--rounds",
        "2",
      ]),
    ).resolves.toBe(true);

    expect(
      fetchMock.mock.calls.map(([input]) => getRequestPath(input)),
    ).toEqual([...expectedRound, ...expectedRound]);
  });

  // release-verify 只传 --base-url：默认必须是 page 模式、不探测 /api/health、只跑一轮。
  it("defaults to one page-mode round without api-health probes", async () => {
    const fetchMock = createPreviewFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      runCloudflarePreviewSmoke(["--base-url", "https://preview.example"]),
    ).resolves.toBe(true);

    expect(
      fetchMock.mock.calls.map(([input]) => getRequestPath(input)),
    ).toEqual([...CORE_PUBLIC_PAGE_PATHS, MISSING_OFFERING_PATH]);
  });

  it.each([
    [
      "wrong content type",
      HEALTHY_HTML,
      { "content-type": "text/plain" },
      ["  - Expected /contact to return HTML, got text/plain"],
    ],
    [
      "truncated body",
      "<!doctype html><html><body>cut off",
      { "content-type": "text/html" },
      [
        "  - Expected /contact HTML body to be at least 1024 bytes, got 34",
        "  - Expected /contact to return a complete HTML document",
      ],
    ],
  ])(
    "fails when an HTML route has a %s",
    async (_case, body, headers, expectedErrors) => {
      captureExpectedConsoleErrors(
        "[cf-preview-smoke] Failures detected:",
        ...expectedErrors,
      );
      const previewFetchMock = createPreviewFetchMock();
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          if (getRequestPath(input) === "/contact") {
            // 用例自带 header 放最后覆盖：每个用例只验证自己瞄准的那类失败。
            return response(200, body, { ...SECURITY_HEADERS, ...headers });
          }

          return previewFetchMock(input, init);
        }),
      );

      await expect(
        runCloudflarePreviewSmoke(["--base-url", "https://preview.example"]),
      ).resolves.toBe(false);
    },
  );
});

describe("deployed smoke", () => {
  it("rejects a cacheable api-health response", async () => {
    const expectedFailure =
      "  - Expected /api/health to carry Cache-Control: no-store, got public, max-age=60";
    captureExpectedConsoleErrors(
      "[post-deploy-smoke] Failures detected:",
      expectedFailure,
    );

    const deployedFetchMock = createDeployedFetchMock();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (getRequestPath(input) === "/api/health") {
          return response(200, '{"status":"ok"}', {
            "content-type": "application/json",
            "cache-control": "public, max-age=60",
          });
        }

        return deployedFetchMock(input, init);
      }),
    );

    await expect(
      runDeployedSmoke([
        "--base-url",
        "https://deployed.example",
        "--header-name",
        "x-smoke-secret",
        "--header-value",
        "proof",
      ]),
    ).resolves.toBe(false);
  });

  it("passes proof headers through every deployed route probe", async () => {
    const fetchMock = createDeployedFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      runDeployedSmoke([
        "--base-url",
        "https://deployed.example",
        "--header-name",
        "x-smoke-secret",
        "--header-value",
        "proof",
      ]),
    ).resolves.toBe(true);

    // 路由清单来自页面注册表；首页必须在其中，独立于注册表本身。
    expect(CORE_PUBLIC_PAGE_PATHS).toContain("/");
    expect(
      fetchMock.mock.calls.map(([input]) => getRequestPath(input)),
    ).toEqual(DEPLOYED_SMOKE_PATHS);
    expect(
      fetchMock.mock.calls.every(
        ([, init]) =>
          (init?.headers as Record<string, string>)["x-smoke-secret"] ===
          "proof",
      ),
    ).toBe(true);
  });

  it("retries transient deployed 5xx responses before failing the proof", async () => {
    vi.useFakeTimers();

    let privacyAttempts = 0;
    const deployedFetchMock = createDeployedFetchMock();
    const fetchMock = vi.fn(
      async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> => {
        const pathname = getRequestPath(input);

        if (pathname === "/privacy") {
          privacyAttempts += 1;
          return privacyAttempts === 1
            ? response(500, "temporary failure")
            : response(200, HEALTHY_HTML, {
                "content-type": "text/html; charset=utf-8",
                ...SECURITY_HEADERS,
              });
        }

        return deployedFetchMock(input, init);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const smokePromise = runDeployedSmoke([
      "--base-url",
      "https://deployed.example",
      "--header-name",
      "x-smoke-secret",
      "--header-value",
      "proof",
    ]);

    await vi.runAllTimersAsync();

    await expect(smokePromise).resolves.toBe(true);
    expect(privacyAttempts).toBe(2);
  });

  it.each([
    [
      "plain text response",
      HEALTHY_HTML,
      { "content-type": "text/plain" },
      ["  - Expected /contact to return HTML, got text/plain"],
    ],
    [
      "truncated HTML response",
      `<!doctype html><html><body>${"cut off".repeat(200)}`,
      { "content-type": "text/html" },
      ["  - Expected /contact to return a complete HTML document"],
    ],
    [
      "rendered application error",
      `<!doctype html><html><body>Application error${"x".repeat(1100)}</body></html>`,
      { "content-type": "text/html" },
      ["  - Unexpected application error surfaced on /contact"],
    ],
  ])(
    "rejects a deployed page with a %s",
    async (_case, body, headers, expectedErrors) => {
      captureExpectedConsoleErrors(
        "[post-deploy-smoke] Failures detected:",
        ...expectedErrors,
      );
      const deployedFetchMock = createDeployedFetchMock();
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          if (getRequestPath(input) === "/contact") {
            // 用例自带 header 放最后覆盖：每个用例只验证自己瞄准的那类失败。
            return response(200, body, { ...SECURITY_HEADERS, ...headers });
          }

          return deployedFetchMock(input, init);
        }),
      );

      await expect(
        runDeployedSmoke([
          "--base-url",
          "https://deployed.example",
          "--header-name",
          "x-smoke-secret",
          "--header-value",
          "proof",
        ]),
      ).resolves.toBe(false);
    },
  );

  it("runs deployed smoke from a minimal fixture without node_modules", async () => {
    const { baseUrl, paths } = await listenForDeployedSmoke();
    const fixtureRoot = createMinimalCloudflareSmokeFixture();

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed child path under a test-owned fixture root
    expect(existsSync(path.join(fixtureRoot, "node_modules"))).toBe(false); // nosemgrep: test-no-file-existence-assertion -- 验证 smoke 无依赖运行的前提，不是锁定源码布局。

    const result = await runNodeCommand(
      [
        "scripts/quality/checks/cloudflare-smoke.js",
        "deployed-smoke",
        "--base-url",
        baseUrl,
      ],
      fixtureRoot,
    );

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("Cannot find module");
    // Concurrent probing makes arrival order non-deterministic; assert the set.
    expect([...paths].sort()).toEqual(
      [
        ...CORE_PUBLIC_PAGE_PATHS,
        MISSING_OFFERING_PATH,
        "/api/health",
        "/.well-known/security.txt",
        "/security-policy.txt",
        "/api/inquiry",
      ].sort(),
    );
    expect(result.stdout).toContain("[post-deploy-smoke] All checks passed");
    expect(result.stdout).toContain(
      "DNS, TLS, and custom-domain confirmation stay manual",
    );
  });

  it("rejects incomplete proof header configuration", async () => {
    await expect(
      runDeployedSmoke([
        "--base-url",
        "https://deployed.example",
        "--header-name",
        "x-smoke-secret",
      ]),
    ).rejects.toThrow(
      "Both --header-name and --header-value must be provided together",
    );
  });

  it("probes the mandatory deployed routes concurrently", async () => {
    let releaseRoot!: () => void;
    const rootHeld = new Promise<void>((resolve) => {
      releaseRoot = resolve;
    });
    const requested = new Set<string>();
    const deployedFetchMock = createDeployedFetchMock();
    const fetchMock = vi.fn(
      async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> => {
        const pathname = getRequestPath(input);
        requested.add(pathname);
        // Hold "/" open; a sequential probe would never reach the other routes.
        if (pathname === "/") await rootHeld;
        return deployedFetchMock(input, init);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const smokePromise = runDeployedSmoke([
      "--base-url",
      "https://deployed.example",
      "--header-name",
      "x-smoke-secret",
      "--header-value",
      "proof",
    ]);

    await vi.waitFor(() => {
      expect(requested.has("/privacy")).toBe(true);
      expect(requested.has("/contact")).toBe(true);
      expect(requested.has("/api/health")).toBe(true);
    });

    releaseRoot();
    await expect(smokePromise).resolves.toBe(true);
  });

  it("fails deployed smoke when a route leaks x-middleware-set-cookie", async () => {
    captureExpectedConsoleErrors(
      "[post-deploy-smoke] Failures detected:",
      "  - Unexpected x-middleware-set-cookie leak on ",
    );
    const deployedFetchMock = createDeployedFetchMock();
    const fetchMock = vi.fn(
      async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> => {
        // Correct status per route, but middleware cookie leaks through.
        const base = await deployedFetchMock(input, init);
        const headers = new Headers(base.headers);
        headers.set("x-middleware-set-cookie", "locale=en");
        return new Response(await base.text(), {
          status: base.status,
          headers,
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      runDeployedSmoke([
        "--base-url",
        "https://deployed.example",
        "--header-name",
        "x-smoke-secret",
        "--header-value",
        "proof",
      ]),
    ).resolves.toBe(false);
  });

  it("propagates non-retriable failures from the deployed lane unchanged", async () => {
    const nonRetriable = new Error("synthetic non-retriable");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(nonRetriable);

    await expect(
      runDeployedSmoke(["--base-url", "https://deployed.example"]),
    ).rejects.toBe(nonRetriable);

    fetchSpy.mockRestore();
  });

  it("wraps retry-exhausted retriable failures in the retry-loop error contract", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(RETRIABLE_TIMEOUT_ERROR);

    const smoke = expect(
      runDeployedSmoke(["--base-url", "https://deployed.example"]),
    ).rejects.toThrow("post-deploy-smoke retry loop exited without a response");
    await vi.runAllTimersAsync();
    await smoke;
    // 每条路由 1 次初始请求 + 2 次重试（DEPLOY_SMOKE_REQUEST_RETRIES），全部失败后包装。
    expect(fetchSpy).toHaveBeenCalledTimes(DEPLOYED_SMOKE_PATHS.length * 3);

    fetchSpy.mockRestore();
  });
});

describe("smoke argument contracts", () => {
  // 未知参数与缺值参数共用同一个 fail-closed 错误合同。
  it.each([
    [
      "cf-preview-smoke",
      ["--base-url"],
      "--base-url",
      runCloudflarePreviewSmoke,
    ],
    ["external-url-smoke", ["--base-url"], "--base-url", runExternalUrlSmoke],
    [
      "deployed-smoke",
      ["--base-url", "https://deployed.example", "--header-name"],
      "--header-name",
      runDeployedSmoke,
    ],
    ["cf-preview-smoke", ["--bogus"], "--bogus", runCloudflarePreviewSmoke],
  ])(
    "%s rejects %j with the unknown-argument error",
    async (_lane, args, arg, run) => {
      await expect(run(args)).rejects.toThrow(`Unknown argument: ${arg}`);
    },
  );
});
