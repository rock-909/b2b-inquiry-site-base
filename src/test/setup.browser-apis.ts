import { vi } from "vitest";

// jsdom 没有 matchMedia。实现必须写进 vi.fn(impl)：setup.hooks.ts 每个用例前的
// vi.resetAllMocks() 会回到这个实现；写成 mockImplementation 会被清空成返回 undefined。
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn((query: string) => ({
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
