import { vi } from "vitest";

// Mock CSS imports to avoid PostCSS processing in tests
vi.mock("@/app/globals.css", () => ({ default: {} }));

// Mock server-only to prevent import errors in test environment
vi.mock("server-only", () => ({}));

vi.mock("next/font/local", () => ({
  default: vi.fn(() => ({
    variable: "--font-open-sans",
    className: "open-sans",
    style: { fontFamily: "Open Sans" },
  })),
}));
