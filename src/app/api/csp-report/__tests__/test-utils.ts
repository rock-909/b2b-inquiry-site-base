import { vi } from "vitest";

/**
 * Narrow warning suppression for the CSP report route tests.
 *
 * The route logs every accepted violation through `logger.warn`. These suites
 * exercise that logging on purpose, so we suppress only the known warning lines
 * while keeping every `console.error` under the global fail-fast gate.
 *
 * This uses the same named-reason + pass-through policy as the global console
 * gate instead of a blanket mock that would swallow all console output.
 */
const EXPECTED_CSP_WARNING_PREFIXES = [
  "CSP Violation Report",
  "Empty CSP report batch",
];

// Captured once at module load, before any spy replaces the console methods.
const originalWarn = console.warn;

function isExpectedCspLog(args: unknown[]): boolean {
  const [first] = args;
  return (
    typeof first === "string" &&
    EXPECTED_CSP_WARNING_PREFIXES.some((prefix) => first.startsWith(prefix))
  );
}

/**
 * Suppress the CSP route's expected warning lines while letting any
 * unexpected console output through. Call inside `beforeEach`; the spies are
 * cleaned up by the suite's `vi.restoreAllMocks()`.
 */
export function suppressExpectedCspWarnings(): void {
  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    if (!isExpectedCspLog(args)) {
      originalWarn.call(console, ...args);
    }
  });
}
