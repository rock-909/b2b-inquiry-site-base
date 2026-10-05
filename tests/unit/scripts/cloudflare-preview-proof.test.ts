/* eslint-disable security/detect-non-literal-fs-filename -- 路径都位于本测试创建的临时 fixture 下 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { moveOwnedTempDirectoryToTrash } from "@/test/temp-fixture";
import { runChildCommand } from "../../../scripts/quality/checks/cloudflare-smoke.js";

const FIXTURE_PREFIX = "b2b-cf-preview-proof-";
const PREVIEW_URL = "https://b2b-preview.example.workers.dev";
const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    moveOwnedTempDirectoryToTrash(tempDir, FIXTURE_PREFIX);
  }
});

// 子进程边界上的替身：假的 pnpm / node 只记录调用顺序并按环境变量输出，
// 证明通道本身（含 git）仍是真实进程。
function createProofFixture() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), FIXTURE_PREFIX));
  tempDirs.push(rootDir);

  const checksDir = path.join(rootDir, "scripts", "quality", "checks");
  mkdirSync(checksDir, { recursive: true });
  copyFileSync(
    path.resolve("scripts/quality/checks/cloudflare-smoke.js"),
    path.join(checksDir, "cloudflare-smoke.js"),
  );

  const binDir = path.join(rootDir, "bin");
  mkdirSync(binDir);
  const callLog = path.join(rootDir, "calls.log");
  const fakePnpm = [
    "#!/bin/sh",
    'echo "pnpm $*" >> "$FAKE_CALL_LOG"',
    'case "$1" in',
    '  website:build:cf) printf "%s\\n" "$FAKE_BUILD_OUTPUT"; exit "${FAKE_BUILD_EXIT:-0}" ;;',
    `  exec) echo "Deployed to ${PREVIEW_URL}"; exit 0 ;;`,
    "esac",
    "exit 1",
    "",
  ].join("\n");
  const fakeNode = ["#!/bin/sh", 'echo "node $*" >> "$FAKE_CALL_LOG"', ""].join(
    "\n",
  );
  for (const [name, body] of [
    ["pnpm", fakePnpm],
    ["node", fakeNode],
  ] as const) {
    writeFileSync(path.join(binDir, name), body);
    chmodSync(path.join(binDir, name), 0o755);
  }

  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: rootDir, encoding: "utf8" }).trim();
  git("init", "--quiet");
  git(
    "-c",
    "user.name=fixture",
    "-c",
    "user.email=fixture@example.com",
    "commit",
    "--allow-empty",
    "--quiet",
    "-m",
    "fixture",
  );

  return {
    commitSha: git("rev-parse", "HEAD"),
    readCalls: () =>
      existsSync(callLog)
        ? readFileSync(callLog, "utf8").trim().split("\n")
        : [],
    readProof: () =>
      JSON.parse(
        readFileSync(
          path.join(
            rootDir,
            "reports",
            "deploy",
            "cloudflare-preview-proof.json",
          ),
          "utf8",
        ),
      ) as Record<string, unknown>,
    runLane: (env: Record<string, string> = {}) =>
      spawnSync(
        process.execPath,
        ["scripts/quality/checks/cloudflare-smoke.js", "cf-preview-deployed"],
        {
          cwd: rootDir,
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
            FAKE_CALL_LOG: callLog,
            ...env,
          },
        },
      ),
  };
}

describe("cloudflare preview deploy proof", () => {
  it("builds the current code before deploying and records the commit it proved", () => {
    const fixture = createProofFixture();

    const result = fixture.runLane({ FAKE_BUILD_OUTPUT: "build ok" });

    expect(result.status).toBe(0);
    expect(fixture.readCalls()).toEqual([
      "pnpm website:build:cf",
      "pnpm exec opennextjs-cloudflare deploy --env preview",
      `node scripts/quality/checks/cloudflare-smoke.js deployed-smoke --base-url ${PREVIEW_URL}`,
    ]);
    expect(fixture.readProof()).toMatchObject({
      status: "pass",
      commitSha: fixture.commitSha,
      baseUrl: PREVIEW_URL,
    });
  });

  it("fails without deploying when the build log reports MISSING_MESSAGE", () => {
    const fixture = createProofFixture();

    const result = fixture.runLane({
      FAKE_BUILD_OUTPUT: "IntlError: MISSING_MESSAGE: Could not resolve key",
    });

    expect(result.status).toBe(1);
    expect(fixture.readCalls()).toEqual(["pnpm website:build:cf"]);
    expect(fixture.readProof()).toMatchObject({
      status: "fail",
      stage: "build-log",
      commitSha: fixture.commitSha,
    });
  });

  it("fails without deploying when the build itself fails", () => {
    const fixture = createProofFixture();

    const result = fixture.runLane({
      FAKE_BUILD_OUTPUT: "build exploded",
      FAKE_BUILD_EXIT: "3",
    });

    expect(result.status).toBe(1);
    expect(fixture.readCalls()).toEqual(["pnpm website:build:cf"]);
    expect(fixture.readProof()).toMatchObject({
      status: "fail",
      stage: "build",
      commitSha: fixture.commitSha,
    });
  });
});

describe("runChildCommand", () => {
  it("kills a child that outlives its timeout instead of waiting for it", () => {
    const result = runChildCommand(
      process.execPath,
      ["-e", "setTimeout(() => {}, 30000)"],
      300,
    );

    expect((result.error as NodeJS.ErrnoException | undefined)?.code).toBe(
      "ETIMEDOUT",
    );
    expect(result.signal).toBe("SIGKILL");
  });
});
