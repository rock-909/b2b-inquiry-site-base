/**
 * 测试输出策略：普通日志默认静默，未明确断言的 console.error 直接让测试失败。
 *
 * 设计目标：
 * - 不改变业务代码的 logger/console 调用路径（测试仍可通过 spy/断言验证是否打日志）
 * - 普通日志默认不写到 stdout/stderr（CI 更干净）
 * - error 必须由测试窄范围捕获并断言，否则 afterEach 报错
 * - 需要调试时允许显式开启（VITEST_SHOW_LOGS=1）
 */

import { afterEach } from "vitest";

function isTruthyEnv(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "TRUE";
}

const SHOULD_SHOW_LOGS = isTruthyEnv(process.env.VITEST_SHOW_LOGS);
const originalConsoleError = console.error.bind(console);
const unexpectedConsoleErrors: unknown[][] = [];

function formatConsoleArgument(value: unknown): string {
  if (value instanceof Error) return value.stack ?? value.message;
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export function createUnexpectedConsoleError(
  calls: readonly (readonly unknown[])[],
): Error | undefined {
  if (calls.length === 0) return undefined;

  const details = calls
    .map(
      (args, index) =>
        `${index + 1}. ${args.map(formatConsoleArgument).join(" ")}`,
    )
    .join("\n");

  return new Error(`Unexpected console.error call(s):\n${details}`);
}

afterEach(() => {
  const calls = unexpectedConsoleErrors.splice(0);
  const error = createUnexpectedConsoleError(calls);

  if (error) throw error;
});

if (!SHOULD_SHOW_LOGS) {
  const noop = (): void => {};

  // 使用 defineProperty：保证属性可写/可配置，便于测试文件里 vi.spyOn / mockImplementation。
  Object.defineProperty(console, "debug", {
    value: noop,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(console, "info", {
    value: noop,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(console, "log", {
    value: noop,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(console, "warn", {
    value: noop,
    writable: true,
    configurable: true,
  });
  // 过滤 jsdom 的固定噪音（它会绕过 console mock，直接写到 stderr）。
  // 典型表现：测试全部通过后仍输出 "Not implemented: navigation to another Document"。
  const JSDOM_NAVIGATION_NOISE =
    "Not implemented: navigation to another Document";

  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  const stderrWrite = originalStderrWrite as unknown as (
    chunk: unknown,
    encoding?: unknown,
    cb?: unknown,
  ) => boolean;
  Object.defineProperty(process.stderr, "write", {
    value: (chunk: unknown, encoding?: unknown, cb?: unknown) => {
      const text =
        typeof chunk === "string"
          ? chunk
          : chunk instanceof Uint8Array
            ? Buffer.from(chunk).toString("utf8")
            : String(chunk);

      if (text.includes(JSDOM_NAVIGATION_NOISE)) {
        const cleaned = text.replaceAll(JSDOM_NAVIGATION_NOISE, "");
        if (cleaned.trim().length === 0) {
          if (typeof cb === "function") cb();
          return true;
        }
        return stderrWrite(cleaned);
      }

      return stderrWrite(chunk, encoding, cb);
    },
    writable: true,
    configurable: true,
  });
}

Object.defineProperty(console, "error", {
  value: (...args: unknown[]) => {
    unexpectedConsoleErrors.push(args);
    if (SHOULD_SHOW_LOGS) originalConsoleError(...args);
  },
  writable: true,
  configurable: true,
});
