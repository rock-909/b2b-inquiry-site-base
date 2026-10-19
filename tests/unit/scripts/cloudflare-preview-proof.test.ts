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
const PREVIEW_DEPLOY_COMMAND = [
  "pnpm exec opennextjs-cloudflare deploy --env preview --keep-vars",
  `--var NEXT_PUBLIC_BASE_URL:${PREVIEW_URL}`,
  `--var NEXT_PUBLIC_SITE_URL:${PREVIEW_URL}`,
  "--var TURNSTILE_ALLOWED_HOSTS:localhost,127.0.0.1,b2b-preview.example.workers.dev",
].join(" ");
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
  const buildEnvLog = path.join(rootDir, "build-env.log");
  const fakePnpm = [
    "#!/bin/sh",
    'echo "pnpm $*" >> "$FAKE_CALL_LOG"',
    'case "$1" in',
    '  website:build:cf) echo "$NEXT_PUBLIC_BASE_URL $NEXT_PUBLIC_SITE_URL" >> "$FAKE_BUILD_ENV_LOG"; printf "%s\\n" "$FAKE_BUILD_OUTPUT"; exit "${FAKE_BUILD_EXIT:-0}" ;;',
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
    binDir,
    commitSha: git("rev-parse", "HEAD"),
    readCalls: () =>
      existsSync(callLog)
        ? readFileSync(callLog, "utf8").trim().split("\n")
        : [],
    readBuildEnv: () => readFileSync(buildEnvLog, "utf8").trim(),
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
    runLane: (
      env: Record<string, string> = {},
      args: string[] = ["--base-url", PREVIEW_URL],
    ) =>
      spawnSync(
        process.execPath,
        [
          "scripts/quality/checks/cloudflare-smoke.js",
          "cf-preview-deployed",
          ...args,
        ],
        {
          cwd: rootDir,
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
            FAKE_CALL_LOG: callLog,
            FAKE_BUILD_ENV_LOG: buildEnvLog,
            DEPLOY_SMOKE_BASE_URL: "",
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
      PREVIEW_DEPLOY_COMMAND,
      `node scripts/quality/checks/cloudflare-smoke.js deployed-smoke --base-url ${PREVIEW_URL}`,
    ]);
    expect(fixture.readProof()).toMatchObject({
      status: "pass",
      commitSha: fixture.commitSha,
      baseUrl: PREVIEW_URL,
    });
    expect(fixture.readBuildEnv()).toBe(`${PREVIEW_URL} ${PREVIEW_URL}`);
  });

  it.each([
    ["empty", ""],
    ["a non-https URL", "http://b2b-preview.example.workers.dev"],
    ["the .invalid placeholder", "https://example.invalid"],
    [
      "the .invalid placeholder with a trailing dot",
      "https://example.invalid.",
    ],
    ["a bare invalid. host", "https://invalid."],
    ["shell metacharacters in the host", "https://$(reviewprobe).example.com"],
    ["userinfo", "https://user:pw@b2b-preview.example.workers.dev"],
    ["a newline inside the host", "https://x\ny.example.com"],
    ["surrounding spaces", " https://example.com "],
    ["a trailing newline", "https://example.com\n"],
    ["a Unicode case-folding host", "https://\u212A.example.com"],
    ["percent-encoding", "https://%65xample.com"],
    ["a Unicode host", "https://例子.com"],
    ["a port", "https://example.com:8443"],
    ["a path", "https://example.com/$(reviewprobe)"],
    ["a query", "https://example.com/?q=1"],
  ])(
    "blocks before building or deploying with %s from either entry point",
    (_label, raw) => {
      for (const [args, env] of [
        [["--base-url", raw], {}],
        [[], { DEPLOY_SMOKE_BASE_URL: raw }],
      ] as const) {
        const fixture = createProofFixture();

        const result = fixture.runLane(
          { FAKE_BUILD_OUTPUT: "build ok", ...env },
          [...args],
        );

        expect(result.status).toBe(2);
        expect(fixture.readCalls()).toEqual([]);
        expect(fixture.readProof()).toMatchObject({
          status: "blocked",
          stage: "preview-base-url",
        });
      }
    },
  );

  it("hands a normal preview URL intact to the installed OpenNext runWrangler", () => {
    const fixture = createProofFixture();
    const receiver = path.join(fixture.binDir, "receiver");
    writeFileSync(
      receiver,
      `#!${process.execPath}\nconsole.log("RECEIVED " + JSON.stringify(process.argv.slice(2)));\n`,
    );
    chmodSync(receiver, 0o755);
    // 假的 pnpm 经由真实安装的 runWrangler（shell: true）把参数交给替身 wrangler。
    const runWranglerModule = path.resolve(
      "node_modules/@opennextjs/cloudflare/dist/cli/commands/utils/run-wrangler.js",
    );
    writeFileSync(
      path.join(fixture.binDir, "pnpm"),
      [
        `#!${process.execPath}`,
        'if (process.argv[2] === "website:build:cf") process.exit(0);',
        `import(${JSON.stringify(runWranglerModule)}).then(({ runWrangler }) => {`,
        `  const result = runWrangler({ packager: ${JSON.stringify(receiver)} }, process.argv.slice(4), { logging: "none" });`,
        "  process.stdout.write(result.stdout);",
        `  console.log(${JSON.stringify(`Deployed ${PREVIEW_URL}`)});`,
        "});",
        "",
      ].join("\n"),
    );

    const result = fixture.runLane();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      `RECEIVED ${JSON.stringify([
        "exec",
        "wrangler",
        "deploy",
        "--env",
        "preview",
        "--keep-vars",
        "--var",
        `NEXT_PUBLIC_BASE_URL:${PREVIEW_URL}`,
        "--var",
        `NEXT_PUBLIC_SITE_URL:${PREVIEW_URL}`,
        "--var",
        "TURNSTILE_ALLOWED_HOSTS:localhost,127.0.0.1,b2b-preview.example.workers.dev",
      ])}`,
    );
  });

  it("reads the preview URL from DEPLOY_SMOKE_BASE_URL", () => {
    const fixture = createProofFixture();

    const result = fixture.runLane(
      { FAKE_BUILD_OUTPUT: "build ok", DEPLOY_SMOKE_BASE_URL: PREVIEW_URL },
      [],
    );

    expect(result.status).toBe(0);
    expect(fixture.readCalls()[1]).toBe(PREVIEW_DEPLOY_COMMAND);
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
      PREVIEW_DEPLOY_COMMAND,
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
