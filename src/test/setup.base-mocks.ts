import { vi } from "vitest";

// Mock CSS imports to avoid PostCSS processing in tests
vi.mock("@/app/globals.css", () => ({ default: {} }));

// Mock server-only to prevent import errors in test environment
vi.mock("server-only", () => ({}));

// Mock next/font/google for Open Sans + JetBrains Mono
vi.mock("next/font/google", () => ({
  Open_Sans: vi.fn(() => ({
    variable: "--font-open-sans",
    className: "open-sans",
    style: { fontFamily: "Open Sans" },
  })),
  JetBrains_Mono: vi.fn(() => ({
    variable: "--font-jetbrains-mono",
    className: "jetbrains-mono",
    style: { fontFamily: "JetBrains Mono" },
  })),
}));

vi.mock("next/font/local", () => ({
  default: vi.fn(() => ({
    variable: "--font-open-sans",
    className: "open-sans",
    style: { fontFamily: "Open Sans" },
  })),
}));
