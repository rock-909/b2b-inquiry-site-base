import { vi } from "vitest";

/**
 * Mock logger for testing
 * 测试用日志模块 Mock：只替换输出，PII 脱敏函数用真实实现。
 */
export const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  log: vi.fn(),
};

export const { sanitizeEmail, sanitizeIP } =
  await vi.importActual<typeof import("@/lib/logger")>("@/lib/logger");
