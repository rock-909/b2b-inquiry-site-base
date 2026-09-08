import { afterEach, expect, it, vi } from "vitest";
import { captureExpectedConsoleErrors } from "@/test/console";
import {
  TURNSTILE_VERIFY_TIMEOUT_MS,
  verifyTurnstileDetailed,
} from "@/lib/security/turnstile";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
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
