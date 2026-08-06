import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createUnexpectedConsoleError } from "@/test/setup.console";

const require = createRequire(import.meta.url);
const vitestCli = resolve(
  dirname(require.resolve("vitest/package.json")),
  "vitest.mjs",
);
const fixtureConfig = resolve(
  "src/test/fixtures/console-gate/vitest.config.mts",
);

function runConsoleGateFixture(filename: string) {
  const fixturePath = resolve("src/test/fixtures/console-gate", filename);
  return spawnSync(
    process.execPath,
    [
      vitestCli,
      "run",
      "--config",
      fixtureConfig,
      fixturePath,
      "--reporter=dot",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 30_000,
    },
  );
}

describe("unexpected console.error gate", () => {
  it("allows an empty test and rejects collected errors with useful details", () => {
    expect(createUnexpectedConsoleError([])).toBeUndefined();

    const error = createUnexpectedConsoleError([
      ["Turnstile failed", { code: "network-error" }],
      [new Error("secondary failure")],
    ]);

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain("1. Turnstile failed");
    expect(error?.message).toContain('"code":"network-error"');
    expect(error?.message).toContain("2. Error: secondary failure");
  });

  it("fails a real Vitest run on an unhandled error and passes an asserted one", () => {
    const unexpected = runConsoleGateFixture("unexpected.fixture.ts");
    const unexpectedOutput = `${unexpected.stdout}${unexpected.stderr}`;

    expect(unexpected.status).not.toBe(0);
    expect(unexpectedOutput).toContain("Unexpected console.error call(s)");
    expect(unexpectedOutput).toContain("console-gate-unexpected-sentinel");

    const expected = runConsoleGateFixture("expected.fixture.ts");
    const expectedOutput = `${expected.stdout}${expected.stderr}`;

    expect(expected.status, expectedOutput).toBe(0);
  });

  it("also rejects errors raised during module loading or after an expected capture", () => {
    for (const [fixture, sentinel] of [
      ["top-level-unexpected.fixture.ts", "console-gate-top-level-sentinel"],
      ["mixed.fixture.ts", "console-gate-mixed-unexpected-sentinel"],
    ] as const) {
      const result = runConsoleGateFixture(fixture);
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status).not.toBe(0);
      expect(output).toContain("Unexpected console.error call(s)");
      expect(output).toContain(sentinel);
    }
  });
});
