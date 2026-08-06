import { vi } from "vitest";

const unfilteredConsoleError = console.error;

/**
 * Capture an error path a test intentionally exercises while forwarding every
 * other error to the global unexpected-console gate.
 */
export function captureExpectedConsoleErrors(...expectedPrefixes: string[]) {
  return vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const [first] = args;
    const isExpected =
      typeof first === "string" &&
      expectedPrefixes.some((prefix) => first.startsWith(prefix));

    if (!isExpected) {
      unfilteredConsoleError(...args);
    }
  });
}
