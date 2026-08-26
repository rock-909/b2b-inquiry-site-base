import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OFFERINGS, getOfferingPath } from "@/config/offerings";
import { captureExpectedConsoleErrors } from "@/test/console";
import { moveOwnedTempDirectoryToTrash } from "@/test/temp-fixture";
import {
  runCloudflarePreviewSmoke,
  runDeployedSmoke,
  runExternalUrlSmoke,
} from "../../../scripts/quality/checks/cloudflare-smoke.js";

const RETRIABLE_TIMEOUT_ERROR = new DOMException(
  "request timed out",
  "TimeoutError",
);

const openServers: http.Server[] = [];
const tempDirs: string[] = [];
const FIXTURE_PREFIX = "b2b-minimal-cloudflare-smoke-";
const HEALTHY_HTML = `<!doctype html><html><body>${"healthy page".repeat(100)}</body></html>`;
const OFFERING_PATH = getOfferingPath(OFFERINGS[0].id);
const MISSING_OFFERING_PATH = getOfferingPath("__smoke-missing-offering__");
const CORE_PUBLIC_PAGE_PATHS = [
  "/",
  "/products",
  OFFERING_PATH,
  "/about",
  "/contact",
  "/privacy",
  "/terms",
] as const;

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

      if (
        CORE_PUBLIC_PAGE_PATHS.includes(
          pathname as (typeof CORE_PUBLIC_PAGE_PATHS)[number],
        )
      ) {
        const headers = new Headers({
          "content-type": "text/html; charset=utf-8",
          ...SECURITY_HEADERS,
        });
        return response(200, HEALTHY_HTML, headers);
      }

      if (pathname === "/api/health") {
        return response(200, '{"status":"ok"}', {
          "content-type": "application/json",
        });
      }

      if (pathname === MISSING_OFFERING_PATH) {
        return response(404, HEALTHY_HTML, {
          "content-type": "text/html; charset=utf-8",
          ...SECURITY_HEADERS,
        });
      }

      return response(404, HEALTHY_HTML, {
        "content-type": "text/html; charset=utf-8",
        ...SECURITY_HEADERS,
      });
    },
  );
}

function createExternalUrlFetchMock() {
  return vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const pathname = getRequestPath(input);

    if (
      CORE_PUBLIC_PAGE_PATHS.includes(
        pathname as (typeof CORE_PUBLIC_PAGE_PATHS)[number],
      )
    ) {
      return response(200, "healthy external page");
    }

    return response(404, "not found");
  });
}

function createDeployedFetchMock() {
  return vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const pathname = getRequestPath(input);
      const headers = init?.headers as Record<string, string> | undefined;

      if (headers?.["x-smoke-secret"] !== "proof") {
        return response(401, "missing proof header");
      }

      if (
        CORE_PUBLIC_PAGE_PATHS.includes(
          pathname as (typeof CORE_PUBLIC_PAGE_PATHS)[number],
        )
      ) {
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
        return response(200, "ok", { "content-type": "text/plain" });
      }

      if (pathname === "/security-policy.txt") {
        return response(404, "not found", { "content-type": "text/plain" });
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

      if (
        CORE_PUBLIC_PAGE_PATHS.includes(
          pathname as (typeof CORE_PUBLIC_PAGE_PATHS)[number],
        )
      ) {
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

      if (
        CORE_PUBLIC_PAGE_PATHS.includes(
          pathname as (typeof CORE_PUBLIC_PAGE_PATHS)[number],
        )
      ) {
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
        serverResponse.writeHead(200, { "content-type": "text/plain" });
        serverResponse.end("ok");
        return;
      }

      if (pathname === "/security-policy.txt") {
        serverResponse.writeHead(404, { "content-type": "text/plain" });
        serverResponse.end("not found");
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

function createMinimalCloudflareSmokeFixture(): string {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), FIXTURE_PREFIX));
  const focusedChecksDir = path.join(rootDir, "scripts", "quality", "checks");
  const configDir = path.join(rootDir, "src", "config");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temp path created above
  mkdirSync(focusedChecksDir, { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temp path created above
  mkdirSync(configDir, { recursive: true });
  copyFileSync(
    path.resolve("scripts/quality/checks/cloudflare-smoke.js"),
    path.join(focusedChecksDir, "cloudflare-smoke.js"),
  );
  copyFileSync(
    path.resolve("src/config/offerings.ts"),
    path.join(configDir, "offerings.ts"),
  );
  tempDirs.push(rootDir);
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

  for (const tempDir of tempDirs.splice(0)) {
    moveOwnedTempDirectoryToTrash(tempDir, FIXTURE_PREFIX);
  }
});

describe("external URL smoke", () => {
  it("checks an externally supplied URL surface without claiming deploy identity", async () => {
    const fetchMock = createExternalUrlFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      runExternalUrlSmoke(["--base-url", "https://external.example"]),
    ).resolves.toBe(true);

    expect(
      fetchMock.mock.calls.map(([input]) => getRequestPath(input)),
    ).toEqual([...CORE_PUBLIC_PAGE_PATHS]);
  });

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
    const discoveryFetchMock = createPreviewFetchMock();
    vi.stubGlobal("fetch", discoveryFetchMock);
    await runCloudflarePreviewSmoke([
      "--base-url",
      "https://preview.example",
      "--include-api-health",
      "--rounds",
      "1",
    ]);
    const expectedPaths = discoveryFetchMock.mock.calls.map(([input]) =>
      getRequestPath(input),
    );
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

  it("proves preview pages and optional api-health probes", async () => {
    const fetchMock = createPreviewFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      runCloudflarePreviewSmoke([
        "--base-url",
        "https://preview.example",
        "--include-api-health",
      ]),
    ).resolves.toBe(true);

    expect(
      fetchMock.mock.calls.map(([input]) => getRequestPath(input)),
    ).toEqual([
      ...CORE_PUBLIC_PAGE_PATHS,
      MISSING_OFFERING_PATH,
      "/api/health",
    ]);
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

    expect(
      fetchMock.mock.calls.map(([input]) => getRequestPath(input)),
    ).toEqual([
      ...CORE_PUBLIC_PAGE_PATHS,
      MISSING_OFFERING_PATH,
      "/api/health",
      "/.well-known/security.txt",
      "/security-policy.txt",
    ]);
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

    let aboutAttempts = 0;
    const deployedFetchMock = createDeployedFetchMock();
    const fetchMock = vi.fn(
      async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> => {
        const pathname = getRequestPath(input);

        if (pathname === "/about") {
          aboutAttempts += 1;
          return aboutAttempts === 1
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
    expect(aboutAttempts).toBe(2);
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
    expect(existsSync(path.join(fixtureRoot, "node_modules"))).toBe(false);

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
      expect(requested.has("/about")).toBe(true);
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
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(RETRIABLE_TIMEOUT_ERROR);

    await expect(
      runDeployedSmoke(["--base-url", "https://deployed.example"]),
    ).rejects.toThrow("post-deploy-smoke retry loop exited without a response");
    // 1 次初始请求 + DEPLOY_SMOKE_REQUEST_RETRIES 次重试，全部失败后包装。
    expect(fetchSpy).toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});

describe("smoke argument contracts", () => {
  it("keeps the unknown-argument error for a valueless --base-url in cf-preview-smoke", async () => {
    await expect(runCloudflarePreviewSmoke(["--base-url"])).rejects.toThrow(
      "Unknown argument: --base-url",
    );
  });

  it("keeps the unknown-argument error for a valueless --base-url in external-url-smoke", async () => {
    await expect(runExternalUrlSmoke(["--base-url"])).rejects.toThrow(
      "Unknown argument: --base-url",
    );
  });

  it("keeps the unknown-argument error for a valueless --header-name in deployed-smoke", async () => {
    await expect(
      runDeployedSmoke([
        "--base-url",
        "https://deployed.example",
        "--header-name",
      ]),
    ).rejects.toThrow("Unknown argument: --header-name");
  });

  it("keeps the unknown-argument error for unrecognized flags", async () => {
    await expect(runCloudflarePreviewSmoke(["--rounds"])).rejects.toThrow(
      "Unknown argument: --rounds",
    );
  });
});
