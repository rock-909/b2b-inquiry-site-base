/* eslint-disable security/detect-non-literal-fs-filename -- 路径都位于本测试创建的临时 fixture 下 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runChildCommand } from "../../../scripts/quality/checks/cloudflare-smoke.js";

const FIXTURE_PREFIX = "b2b-cf-preview-proof-";
const PREVIEW_URL = "https://b2b-preview.example.workers.dev";
const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// 子进程边界上的替身：假的 pnpm / node 只记录调用顺序并按环境变量输出，
// 证明通道本身（含 git）仍是真实进程。
function createProofFixture() {
  const rootDir = mkdtempSync(path.resolve(FIXTURE_PREFIX));
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
    `  exec) printf "%s\\n" "\${FAKE_DEPLOY_OUTPUT-Deployed to ${PREVIEW_URL}}"; exit 0 ;;`,
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

  it("blocks without smoke when the deploy output has no workers.dev URL", () => {
    const fixture = createProofFixture();

    const result = fixture.runLane({
      FAKE_BUILD_OUTPUT: "build ok",
      FAKE_DEPLOY_OUTPUT: "Uploaded, but no URL was printed",
    });

    expect(result.status).toBe(2);
    expect(fixture.readCalls()).toEqual([
      "pnpm website:build:cf",
      "pnpm exec opennextjs-cloudflare deploy --env preview",
    ]);
    expect(fixture.readProof()).toMatchObject({
      status: "blocked",
      stage: "deploy-output-parse",
      discoveredUrls: [],
    });
  });

  it("smokes the first workers.dev URL in the deploy output and records all of them", () => {
    const fixture = createProofFixture();
    const otherUrl = "https://b2b-other.example.workers.dev";

    const result = fixture.runLane({
      FAKE_BUILD_OUTPUT: "build ok",
      FAKE_DEPLOY_OUTPUT: `Deployed to ${PREVIEW_URL} and ${otherUrl}`,
    });

    expect(result.status).toBe(0);
    expect(fixture.readCalls().at(-1)).toBe(
      `node scripts/quality/checks/cloudflare-smoke.js deployed-smoke --base-url ${PREVIEW_URL}`,
    );
    const proof = fixture.readProof() as {
      baseUrl: string;
      discoveredUrls: { url: string }[];
    };
    expect(proof.baseUrl).toBe(PREVIEW_URL);
    expect(proof.discoveredUrls.map(({ url }) => url)).toEqual([
      PREVIEW_URL,
      otherUrl,
    ]);
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
  it("kills wrapper descendants before they can produce delayed side effects", async () => {
    const rootDir = mkdtempSync(path.resolve(FIXTURE_PREFIX));
    tempDirs.push(rootDir);
    const marker = path.join(rootDir, "marker");
    const result = await runChildCommand(
      "sh",
      [
        "-c",
        '"$1" -e "$2" "$3" & wait',
        "wrapper",
        process.execPath,
        'process.stdout.write("ready"); setTimeout(() => require("node:fs").writeFileSync(process.argv[1], "escaped"), 1500)',
        marker,
      ],
      700,
    );

    await new Promise((resolve) => setTimeout(resolve, 1800));
    expect(result.stdout).toBe("ready");
    expect((result.error as NodeJS.ErrnoException | undefined)?.code).toBe(
      "ETIMEDOUT",
    );
    expect(result.status).toBeNull();
    expect(result.signal).toBe("SIGKILL");
    // nosemgrep: test-no-file-existence-assertion -- 观察被终止子进程没有写出副作用，不是锁定仓库文件形状。
    expect(existsSync(marker)).toBe(false);
  });
});
