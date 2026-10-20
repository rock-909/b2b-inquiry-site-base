import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
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

type FixtureResult = { status: string; output: string };

// 一次嵌套 Vitest 运行覆盖全部 fixture，再按文件读取 JSON 报告。
let gateRun:
  { status: number | null; files: Map<string, FixtureResult> } | undefined;
function runConsoleGateFixtures() {
  if (gateRun) return gateRun;
  const outputFile = join(
    mkdtempSync(join(tmpdir(), "console-gate-")),
    "report.json",
  );
  const result = spawnSync(
    process.execPath,
    [
      vitestCli,
      "run",
      "--config",
      fixtureConfig,
      "--reporter=json",
      `--outputFile=${outputFile}`,
    ],
    { cwd: process.cwd(), encoding: "utf8", timeout: 30_000 },
  );
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- report lives in a test-owned temp directory
  const report = JSON.parse(readFileSync(outputFile, "utf8")) as {
    testResults: {
      name: string;
      status: string;
      message: string;
      assertionResults: { failureMessages: string[] }[];
    }[];
  };
  gateRun = {
    status: result.status,
    files: new Map(
      report.testResults.map((file) => [
        basename(file.name),
        {
          status: file.status,
          output: [
            file.message,
            ...file.assertionResults.flatMap((test) => test.failureMessages),
          ].join("\n"),
        },
      ]),
    ),
  };
  return gateRun;
}

function runConsoleGateFixture(filename: string): FixtureResult {
  const result = runConsoleGateFixtures().files.get(filename);
  expect(result, filename).toBeDefined();
  return result as FixtureResult;
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
    expect(runConsoleGateFixtures().status).not.toBe(0);

    const unexpected = runConsoleGateFixture("unexpected.fixture.ts");

    expect(unexpected.status).toBe("failed");
    expect(unexpected.output).toContain("Unexpected console.error call(s)");
    expect(unexpected.output).toContain("console-gate-unexpected-sentinel");

    const expected = runConsoleGateFixture("expected.fixture.ts");

    expect(expected.status, expected.output).toBe("passed");
  }, 35_000);

  it("also rejects errors raised during module loading or after an expected capture", () => {
    for (const [fixture, sentinel] of [
      ["top-level-unexpected.fixture.ts", "console-gate-top-level-sentinel"],
      ["mixed.fixture.ts", "console-gate-mixed-unexpected-sentinel"],
    ] as const) {
      const result = runConsoleGateFixture(fixture);

      expect(result.status).toBe("failed");
      expect(result.output).toContain("Unexpected console.error call(s)");
      expect(result.output).toContain(sentinel);
    }
  }, 35_000);
});
