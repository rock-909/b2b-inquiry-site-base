import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { captureExpectedConsoleErrors } from "@/test/console";
import { runDeployedSmoke } from "../../../scripts/quality/checks/cloudflare-smoke.js";

const HEALTHY_HTML = `<!doctype html><html><body>${"healthy page".repeat(100)}</body></html>`;
const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy": "default-src 'self'",
};
const PAGE_PATHS = [
  "/",
  "/products",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
];

const openServers: http.Server[] = [];

// 真实 HTTP 服务：其余路由都健康，只让询盘路由按给定状态码响应。
async function listenWithInquiryStatus(inquiryStatus: number) {
  const inquiryRequests: {
    method: string | undefined;
    contentType: string | undefined;
  }[] = [];
  const server = http.createServer((request, serverResponse) => {
    const pathname = request.url ?? "/";

    if (pathname === "/api/inquiry") {
      inquiryRequests.push({
        method: request.method,
        contentType: request.headers["content-type"],
      });
      serverResponse.writeHead(inquiryStatus);
      serverResponse.end("{}");
    } else if (
      PAGE_PATHS.includes(pathname) ||
      pathname.startsWith("/products/")
    ) {
      serverResponse.writeHead(
        PAGE_PATHS.includes(pathname) ? 200 : 404,
        HTML_HEADERS,
      );
      serverResponse.end(HEALTHY_HTML);
    } else if (pathname === "/api/health") {
      serverResponse.writeHead(200, { "cache-control": "no-store" });
      serverResponse.end("ok");
    } else if (pathname === "/.well-known/security.txt") {
      serverResponse.writeHead(200);
      serverResponse.end("ok");
    } else {
      serverResponse.writeHead(404);
      serverResponse.end("not found");
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  openServers.push(server);
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }

  return { baseUrl: `http://127.0.0.1:${address.port}`, inquiryRequests };
}

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
});

describe("deployed smoke inquiry probe", () => {
  it("passes when the inquiry route rejects a non-JSON POST with 415", async () => {
    const { baseUrl, inquiryRequests } = await listenWithInquiryStatus(415);

    await expect(runDeployedSmoke(["--base-url", baseUrl])).resolves.toBe(true);

    expect(inquiryRequests).toHaveLength(1);
    expect(inquiryRequests[0]?.method).toBe("POST");
    expect(inquiryRequests[0]?.contentType).not.toContain("application/json");
  });

  it.each([
    ["crashes", 500],
    ["is missing", 404],
  ])("fails when the inquiry route %s", async (_case, status) => {
    captureExpectedConsoleErrors(
      "[post-deploy-smoke] Failures detected:",
      `  - Expected /api/inquiry to return 415, got ${status}`,
    );
    const { baseUrl } = await listenWithInquiryStatus(status);

    await expect(runDeployedSmoke(["--base-url", baseUrl])).resolves.toBe(
      false,
    );
  });
});
