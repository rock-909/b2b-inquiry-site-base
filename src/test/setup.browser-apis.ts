import { vi } from "vitest";

import "./setup.intersection-observer";

// Enhanced matchMedia mock for accessibility testing
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver for React components that use it
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

globalThis.ResizeObserver =
  MockResizeObserver as unknown as typeof ResizeObserver;

// Mock PerformanceObserver for performance monitoring
class MockPerformanceObserver {
  static readonly supportedEntryTypes = [
    "navigation",
    "resource",
    "measure",
    "mark",
  ];

  observe = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => [] as PerformanceEntryList);
}

globalThis.PerformanceObserver =
  MockPerformanceObserver as unknown as typeof PerformanceObserver;

// Mock requestAnimationFrame for animations
globalThis.requestAnimationFrame = vi.fn((cb) => {
  setTimeout(cb, 0);
  return 1;
});
globalThis.cancelAnimationFrame = vi.fn((id) => clearTimeout(id as number));

// Mock localStorage and sessionStorage
const createStorageMock = () => {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) || null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value.toString());
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    get length() {
      return store.size;
    },
    key: vi.fn((index: number) => {
      const keys = Array.from(store.keys());
      return index >= 0 && index < keys.length ? keys.at(index) || null : null;
    }),
  };
};

Object.defineProperty(window, "localStorage", {
  value: createStorageMock(),
});

Object.defineProperty(window, "sessionStorage", {
  value: createStorageMock(),
});

// Mock CSS.supports for CSS feature detection
Object.defineProperty(window, "CSS", {
  value: {
    supports: vi.fn().mockReturnValue(true),
  },
});

// Mock document.startViewTransition for theme transitions
Object.defineProperty(document, "startViewTransition", {
  value: vi.fn((callback?: () => void) => {
    callback?.();
    return Promise.resolve();
  }),
  writable: true,
});

// Setup DOM container for React Testing Library
if (typeof document !== "undefined") {
  const container = document.createElement("div");
  container.id = "test-container";
  document.body.appendChild(container);
}
