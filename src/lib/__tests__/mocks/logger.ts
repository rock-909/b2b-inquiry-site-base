import { vi } from "vitest";

/**
 * Mock logger for testing
 * 测试用日志模块 Mock
 */
export const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  log: vi.fn(),
};

export const sanitizeEmail = vi.fn((value: string | undefined | null) => {
  if (!value) return "[NO_EMAIL]";
  return "[REDACTED_EMAIL]";
});

export const sanitizeIP = vi.fn((value: string | undefined | null) => {
  if (!value) return "[NO_IP]";
  return "[REDACTED_IP]";
});
