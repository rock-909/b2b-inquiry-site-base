import { afterEach, beforeEach, vi } from "vitest";

// Global test setup
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();

  // Set up environment variables for API tests
  vi.stubEnv("ADMIN_API_TOKEN", "test-admin-token");

  // Reset DOM - 安全的DOM重置
  if (typeof document !== "undefined" && document.body) {
    try {
      document.body.innerHTML = '<div id="test-container"></div>';
    } catch {
      const newBody = document.createElement("body");
      newBody.innerHTML = '<div id="test-container"></div>';
      if (document.documentElement) {
        document.documentElement.replaceChild(newBody, document.body);
      }
    }
  }

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

// Ensure each test starts from a clean slate under Vitest v4
beforeEach(() => {
  vi.resetAllMocks();
});
