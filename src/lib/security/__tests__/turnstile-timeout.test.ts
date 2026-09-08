import { afterEach, expect, it, vi } from "vitest";
import { captureExpectedConsoleErrors } from "@/test/console";
import { logger } from "@/lib/logger";
import {
  TURNSTILE_VERIFY_TIMEOUT_MS,
  verifyTurnstileDetailed,
} from "@/lib/security/turnstile";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("does not log malformed verification response bodies", async () => {
  const log = vi.spyOn(logger, "error").mockImplementation(() => undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("PRIVATE_TOKEN", { status: 200 })),
  );
  await expect(
    verifyTurnstileDetailed("test-token", "127.0.0.1"),
  ).resolves.toEqual({
    success: false,
    errorCodes: ["network-error"],
  });
  expect(log).toHaveBeenCalledWith("Turnstile verification network failure", {
    errorCode: "network-error",
    ip: expect.any(String),
  });
});

it("aborts a stalled response body after receiving successful headers", async () => {
  vi.useFakeTimers();
  const errors = captureExpectedConsoleErrors(
    "Turnstile verification network failure",
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init: RequestInit) => ({
      ok: true,
      json: () =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
          });
        }),
    })),
  );

  const pending = verifyTurnstileDetailed("test-token", "127.0.0.1");
  await vi.advanceTimersByTimeAsync(TURNSTILE_VERIFY_TIMEOUT_MS);
  await expect(pending).resolves.toEqual({
    success: false,
    errorCodes: ["timeout"],
  });
  expect(errors).toHaveBeenCalled();
});
