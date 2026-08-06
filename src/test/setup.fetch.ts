import { vi } from "vitest";

/**
 * Global fetch polyfill and stable mock for externalized messages requests.
 *
 * Purpose:
 * - Avoid ECONNREFUSED when local dev server is not running during unit tests
 * - Provide deterministic responses for /messages/* so tests don't depend on network
 *
 * Scope:
 * - Only intercepts URLs containing '/messages/'
 * - All other requests fall back to the original global fetch if present
 *
 * Environment switch:
 * - Set VITEST_USE_REAL_MESSAGES=true to bypass this mock and use real network
 */
(() => {
  const hasNativeResponse = typeof (globalThis as any).Response !== "undefined";
  const SimpleResponse: any = hasNativeResponse
    ? (globalThis as any).Response
    : class SimpleResponse {
        private _body: string;
        status: number;
        ok: boolean;
        headers: Map<string, string>;
        constructor(
          body: string,
          init: { status: number; headers?: Record<string, string> },
        ) {
          this._body = body ?? "{}";
          this.status = init.status;
          this.ok = this.status >= 200 && this.status < 300;
          this.headers = new Map(Object.entries(init.headers || {}));
        }
        async json() {
          try {
            return JSON.parse(this._body || "{}");
          } catch {
            return {};
          }
        }
        async text() {
          return this._body || "";
        }
      };

  const OriginalFetch = (globalThis as any).fetch as
    ((input: any, init?: any) => Promise<any>) | undefined;

  const mockFetch = vi.fn(async (input: any, init?: any) => {
    const url = (() => {
      try {
        return typeof input === "string"
          ? input
          : input && input.url
            ? (input.url as string)
            : String(input);
      } catch {
        return "";
      }
    })();

    if (!process.env.VITEST_USE_REAL_MESSAGES && url.includes("/messages/")) {
      const body = JSON.stringify({});
      return new SimpleResponse(body, {
        status: 200,
        headers: { "content-type": "application/json" },
      }) as Response;
    }

    if (typeof OriginalFetch === "function") {
      return OriginalFetch(input, init);
    }

    return new SimpleResponse(JSON.stringify({}), {
      status: 200,
      headers: { "content-type": "application/json" },
    }) as Response;
  });

  if (typeof (globalThis as any).Response === "undefined") {
    (globalThis as any).Response = SimpleResponse;
  }
  if (typeof (globalThis as any).Headers === "undefined") {
    (globalThis as any).Headers = class {};
  }

  vi.stubGlobal("fetch", mockFetch);
})();
