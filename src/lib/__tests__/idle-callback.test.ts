import { afterEach, describe, expect, it, vi } from "vitest";
import { requestIdleCallback } from "@/lib/idle-callback";

const CUSTOM_FALLBACK_DELAY_MS = 900;
const BEFORE_CUSTOM_FALLBACK_DELAY_MS = CUSTOM_FALLBACK_DELAY_MS - 1;
const IDLE_CALLBACK_ID = 42;

describe("requestIdleCallback", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("respects a custom fallback delay when requestIdleCallback is unavailable", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.stubGlobal("cancelIdleCallback", undefined);
    const callback = vi.fn();

    requestIdleCallback(callback, {
      fallbackDelay: CUSTOM_FALLBACK_DELAY_MS,
    });

    vi.advanceTimersByTime(BEFORE_CUSTOM_FALLBACK_DELAY_MS);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("does not run a scheduled idle callback after cleanup when cancelIdleCallback is unavailable", () => {
    let scheduledIdleCallback: IdleRequestCallback | undefined;
    const callback = vi.fn();

    vi.stubGlobal(
      "requestIdleCallback",
      vi.fn((idleCallback: IdleRequestCallback) => {
        scheduledIdleCallback = idleCallback;
        return IDLE_CALLBACK_ID;
      }),
    );
    vi.stubGlobal("cancelIdleCallback", undefined);

    const cleanup = requestIdleCallback(callback);
    cleanup();

    scheduledIdleCallback?.({
      didTimeout: false,
      timeRemaining: () => 0,
    });

    expect(callback).not.toHaveBeenCalled();
  });
});
