import { afterEach, beforeEach, vi } from "vitest";

// Global test setup
beforeEach(() => {
  vi.resetAllMocks();

  // Reset localStorage (only if window is available)
  if (typeof window !== "undefined") {
    if (window.localStorage) {
      window.localStorage.clear();
    }
    if (window.sessionStorage) {
      window.sessionStorage.clear();
    }
  }
});

afterEach(() => {
  // Cleanup after each test
  vi.clearAllTimers();
  vi.restoreAllMocks();
});
