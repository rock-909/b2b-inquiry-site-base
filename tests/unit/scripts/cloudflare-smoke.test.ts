/* eslint-disable max-lines -- Smoke modes share lifecycle fixtures; split when another mode is added. */
import { spawn } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
} from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureExpectedConsoleErrors } from "@/test/console";
import {
  runCloudflarePreviewSmoke,
  runDeployedSmoke,
  runExternalUrlSmoke,
} from "../../../scripts/quality/checks/cloudflare-smoke.js";

const openServers: http.Server[] = [];
const tempDirs: string[] = [];
const TEMP_TRASH_ROOT = path.join(
  os.tmpdir(),
  "tucsenberg-cloudflare-smoke-test-trash",
);
const HEALTHY_HTML = `<!doctype html><html><body>${"healthy page".repeat(100)}</body></html>`;
const HEALTHY_RSC = '#1:"$Sreact.fragment"\n2:I[1,[],"default"]';
const HEALTHY_ROUTE_TREE_RSC = '0:{"tree":{"name":"products"}}';

interface ChildProcessResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

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

function createPreviewFetchMock(
  pdfHeaders: HeadersInit = { "x-robots-tag": "noindex" },
) {
  return vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const pathname = getRequestPath(input);
      const requestHeaders = new Headers(init?.headers);

      if (pathname === "/products" && requestHeaders.get("rsc") === "1") {
        const segment = requestHeaders.get("next-router-segment-prefetch");
        const headers = {
          "content-type": "text/x-component",
          "x-nextjs-cache": "HIT",
          ...(segment ? { "x-nextjs-postponed": "2" } : {}),
        };
        return response(
          200,
          segment === "/_tree" ? HEALTHY_ROUTE_TREE_RSC : HEALTHY_RSC,
          headers,
        );
      }

      if (["/", "/products", "/contact", "/request-quote"].includes(pathname)) {
        const headers = new Headers({
          "content-type": "text/html; charset=utf-8",
        });
        if (pathname === "/products") headers.set("x-nextjs-cache", "HIT");
        return response(200, HEALTHY_HTML, headers);
      }

      if (pathname === "/api/health") {
        return response(200, '{"status":"ok"}', {
          "content-type": "application/json",
        });
      }

      if (pathname === "/invalid/contact") {
        return response(404, HEALTHY_HTML, {
          "content-type": "text/html; charset=utf-8",
        });
      }

      if (["/zh", "/zh/contact"].includes(pathname)) {
        return response(404, "Not Found", { "content-type": "text/plain" });
      }

      if (pathname === "/downloads/spec-sheet-tb-bw.pdf") {
        const headers = new Headers(pdfHeaders);
        headers.set("content-type", "application/pdf");
        return response(200, "%PDF-1.7", headers);
      }

      return response(404, HEALTHY_HTML, {
        "content-type": "text/html; charset=utf-8",
      });
    },
  );
}

function createExternalUrlFetchMock() {
  return vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const pathname = getRequestPath(input);

    if (["/", "/products", "/contact", "/request-quote"].includes(pathname)) {
      return response(200, "healthy external page");
    }

    if (["/zh", "/zh/contact"].includes(pathname)) {
      return response(404, "not found");
    }

    return response(404, "not found");
  });
}

function createDeployedFetchMock(
  pdfHeaders: HeadersInit = { "x-robots-tag": "noindex" },
) {
  return vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const pathname = getRequestPath(input);
      const headers = init?.headers as Record<string, string> | undefined;

      if (headers?.["x-smoke-secret"] !== "proof") {
        return response(401, "missing proof header");
      }

      if (
        [
          "/",
          "/products",
          "/contact",
          "/request-quote",
          "/api/health",
          "/.well-known/security.txt",
        ].includes(pathname)
      ) {
        return response(200, "healthy deployed page");
      }

      if (
        [
          "/zh",
          "/zh/contact",
          "/invalid/contact",
          "/security-policy.txt",
        ].includes(pathname)
      ) {
        return response(404, "not found");
      }

      if (pathname === "/downloads/spec-sheet-tb-bw.pdf") {
        return response(200, "%PDF-1.7", pdfHeaders);
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

      if (["/", "/products", "/contact", "/request-quote"].includes(pathname)) {
        serverResponse.writeHead(200, { "content-type": "text/plain" });
        serverResponse.end("ok");
        return;
      }

      if (["/zh", "/zh/contact"].includes(pathname)) {
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
        [
          "/",
          "/products",
          "/contact",
          "/request-quote",
          "/api/health",
          "/.well-known/security.txt",
        ].includes(pathname)
      ) {
        serverResponse.writeHead(200, { "content-type": "text/plain" });
        serverResponse.end("ok");
        return;
      }

      if (
        [
          "/zh",
          "/zh/contact",
          "/invalid/contact",
          "/security-policy.txt",
        ].includes(pathname)
      ) {
        serverResponse.writeHead(404, { "content-type": "text/plain" });
        serverResponse.end("not found");
        return;
      }

      if (pathname === "/downloads/spec-sheet-tb-bw.pdf") {
        serverResponse.writeHead(200, {
          "content-type": "application/pdf",
          "x-robots-tag": "noindex",
        });
        serverResponse.end("%PDF-1.7");
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

function createMinimalStarterChecksFixture(): string {
  const rootDir = mkdtempSync(
    path.join(os.tmpdir(), "tucsenberg-minimal-starter-checks-"),
  );
  const focusedChecksDir = path.join(rootDir, "scripts", "quality", "checks");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test-owned temp path created above
  mkdirSync(focusedChecksDir, { recursive: true });
  copyFileSync(
    path.resolve("scripts/starter-checks.js"),
    path.join(rootDir, "scripts", "starter-checks.js"),
  );
  copyFileSync(
    path.resolve("scripts/quality/checks/cloudflare-smoke.js"),
    path.join(focusedChecksDir, "cloudflare-smoke.js"),
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
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- tracked test-owned temp path
    if (!existsSync(tempDir)) continue;
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed test Trash root under os.tmpdir()
    mkdirSync(TEMP_TRASH_ROOT, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- moves only tracked test-owned temp paths
    renameSync(
      tempDir,
      path.join(TEMP_TRASH_ROOT, `${path.basename(tempDir)}-${Date.now()}`),
    );
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
    ).toEqual([
      "/",
      "/products",
      "/contact",
      "/request-quote",
      "/zh",
      "/zh/contact",
    ]);
  });

  it("keeps the starter-checks facade wired to the external-url-smoke CLI", async () => {
    const { baseUrl, paths } = await listenForExternalUrlSmoke();

    const result = await runNodeCommand([
      "scripts/starter-checks.js",
      "external-url-smoke",
      "--base-url",
      baseUrl,
    ]);

    expect(result.status).toBe(0);
    expect(paths).toEqual([
      "/",
      "/products",
      "/contact",
      "/request-quote",
      "/zh",
      "/zh/contact",
    ]);
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
    const expectedPaths = discoveryFetchMock.mock.calls
      .map(([input]) => getRequestPath(input))
      .slice(0, -5);
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
    ).toEqual([
      "/",
      "/invalid/contact",
      "/products",
      "/contact",
      "/request-quote",
      "/zh",
      "/zh/contact",
      "/downloads/spec-sheet-tb-bw.pdf",
      "/api/health",
      "/",
      "/invalid/contact",
      "/products",
      "/contact",
      "/request-quote",
      "/zh",
      "/zh/contact",
      "/downloads/spec-sheet-tb-bw.pdf",
      "/api/health",
      "/products",
      "/products",
      "/products",
      "/products",
      "/products",
    ]);
    expect(
      fetchMock.mock.calls
        .slice(-3)
        .every(([, init]) => init?.redirect === "follow"),
    ).toBe(true);
  });

  it("proves preview pages, removed locale routes, and optional api-health probes", async () => {
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
      "/",
      "/invalid/contact",
      "/products",
      "/contact",
      "/request-quote",
      "/zh",
      "/zh/contact",
      "/downloads/spec-sheet-tb-bw.pdf",
      "/api/health",
      "/products",
      "/products",
      "/products",
      "/products",
      "/products",
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
            return response(200, body, headers);
          }

          return previewFetchMock(input, init);
        }),
      );

      await expect(
        runCloudflarePreviewSmoke(["--base-url", "https://preview.example"]),
      ).resolves.toBe(false);
    },
  );

  it("fails when the products RSC probe returns HTML", async () => {
    captureExpectedConsoleErrors(
      "[cf-preview-smoke] Failures detected:",
      "  - Expected /products RSC probe to return text/x-component, got text/html; charset=utf-8",
      "  - Expected /products RSC probe to return a non-truncated Flight payload, not HTML",
    );
    const previewFetchMock = createPreviewFetchMock();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        if (
          getRequestPath(input) === "/products" &&
          headers.get("rsc") === "1" &&
          headers.get("next-router-segment-prefetch") === null
        ) {
          return response(200, HEALTHY_HTML, {
            "content-type": "text/html; charset=utf-8",
          });
        }

        return previewFetchMock(input, init);
      }),
    );

    await expect(
      runCloudflarePreviewSmoke(["--base-url", "https://preview.example"]),
    ).resolves.toBe(false);
  });

  it("fails when the products route-tree prefetch misses the segment cache", async () => {
    captureExpectedConsoleErrors(
      "[cf-preview-smoke] Failures detected:",
      "  - Expected /products route-tree prefetch to return X-Nextjs-Postponed: 2, got none",
    );
    const previewFetchMock = createPreviewFetchMock();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        const result = await previewFetchMock(input, init);
        if (headers.get("next-router-segment-prefetch") === "/_tree") {
          result.headers.delete("x-nextjs-postponed");
        }
        return result;
      }),
    );

    await expect(
      runCloudflarePreviewSmoke(["--base-url", "https://preview.example"]),
    ).resolves.toBe(false);
  });

  it("fails when the warmed products response is not a cache hit", async () => {
    captureExpectedConsoleErrors(
      "[cf-preview-smoke] Failures detected:",
      "  - Expected warmed /products to return X-Nextjs-Cache: HIT, got MISS",
    );
    const previewFetchMock = createPreviewFetchMock();
    let productsHtmlRequests = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        if (
          getRequestPath(input) === "/products" &&
          headers.get("rsc") !== "1"
        ) {
          productsHtmlRequests += 1;
          const result = await previewFetchMock(input, init);
          if (productsHtmlRequests >= 3) {
            result.headers.set("x-nextjs-cache", "MISS");
          }
          return result;
        }

        return previewFetchMock(input, init);
      }),
    );

    await expect(
      runCloudflarePreviewSmoke(["--base-url", "https://preview.example"]),
    ).resolves.toBe(false);
  });

  it("fails when the removed Chinese route becomes live again", async () => {
    const consoleError = captureExpectedConsoleErrors(
      "[cf-preview-smoke] Failures detected:",
      "  - Expected /zh to return 404",
    );
    const previewFetchMock = createPreviewFetchMock();
    const fetchMock = vi.fn(
      async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> => {
        if (getRequestPath(input) === "/zh") {
          return response(200, HEALTHY_HTML, {
            "content-type": "text/html; charset=utf-8",
          });
        }

        return previewFetchMock(input, init);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      runCloudflarePreviewSmoke(["--base-url", "https://preview.example"]),
    ).resolves.toBe(false);
    expect(consoleError).toHaveBeenCalledTimes(2);
  });

  it("fails when the preview worker serves a pdf without the noindex header", async () => {
    const consoleError = captureExpectedConsoleErrors(
      "[cf-preview-smoke] Failures detected:",
      "  - Expected /downloads/spec-sheet-tb-bw.pdf to carry X-Robots-Tag: noindex, got none",
    );
    vi.stubGlobal("fetch", createPreviewFetchMock({}));

    await expect(
      runCloudflarePreviewSmoke(["--base-url", "http://127.0.0.1:8787"]),
    ).resolves.toBe(false);
    expect(consoleError).toHaveBeenCalledTimes(2);
  });

  it("passes when the preview worker serves a pdf with the noindex header", async () => {
    vi.stubGlobal("fetch", createPreviewFetchMock());

    await expect(
      runCloudflarePreviewSmoke(["--base-url", "http://127.0.0.1:8787"]),
    ).resolves.toBe(true);
  });
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
      "/",
      "/invalid/contact",
      "/products",
      "/contact",
      "/request-quote",
      "/api/health",
      "/zh",
      "/zh/contact",
      "/.well-known/security.txt",
      "/security-policy.txt",
      "/downloads/spec-sheet-tb-bw.pdf",
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

    let productsAttempts = 0;
    const deployedFetchMock = createDeployedFetchMock();
    const fetchMock = vi.fn(
      async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> => {
        const pathname = getRequestPath(input);

        if (pathname === "/products") {
          productsAttempts += 1;
          return productsAttempts === 1
            ? response(500, "temporary failure")
            : response(200, "recovered");
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
    expect(productsAttempts).toBe(2);
  });

  it("runs deployed smoke from a minimal fixture without node_modules", async () => {
    const { baseUrl, paths } = await listenForDeployedSmoke();
    const fixtureRoot = createMinimalStarterChecksFixture();

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed child path under a test-owned fixture root
    expect(existsSync(path.join(fixtureRoot, "node_modules"))).toBe(false);

    const result = await runNodeCommand(
      ["scripts/starter-checks.js", "deployed-smoke", "--base-url", baseUrl],
      fixtureRoot,
    );

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("Cannot find module");
    // Concurrent probing makes arrival order non-deterministic; assert the set.
    expect([...paths].sort()).toEqual(
      [
        "/",
        "/invalid/contact",
        "/products",
        "/contact",
        "/request-quote",
        "/api/health",
        "/zh",
        "/zh/contact",
        "/.well-known/security.txt",
        "/security-policy.txt",
        "/downloads/spec-sheet-tb-bw.pdf",
      ].sort(),
    );
    expect(result.stdout).toContain("[post-deploy-smoke] All checks passed");
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

  it("fails when the deployed PDF loses its noindex header", async () => {
    captureExpectedConsoleErrors(
      "[post-deploy-smoke] Failures detected:",
      "  - Expected /downloads/spec-sheet-tb-bw.pdf to carry X-Robots-Tag: noindex, got none",
    );
    vi.stubGlobal("fetch", createDeployedFetchMock({}));

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
      expect(requested.has("/products")).toBe(true);
      expect(requested.has("/contact")).toBe(true);
      expect(requested.has("/request-quote")).toBe(true);
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
});
