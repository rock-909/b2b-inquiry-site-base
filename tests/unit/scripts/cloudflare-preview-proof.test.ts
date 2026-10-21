/* eslint-disable security/detect-non-literal-fs-filename -- 路径都位于本测试创建的临时 fixture 下 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseCloudflarePreviewUrl,
  runChildCommand,
} from "../../../scripts/quality/checks/cloudflare-smoke.js";

const FIXTURE_PREFIX = "b2b-cf-preview-proof-";
const PREVIEW_URL = "https://b2b-preview.example.workers.dev";
const PREVIEW_DEPLOY_COMMAND = [
  "pnpm exec opennextjs-cloudflare deploy --env preview --keep-vars",
  `--var NEXT_PUBLIC_BASE_URL:${PREVIEW_URL}`,
  `--var NEXT_PUBLIC_SITE_URL:${PREVIEW_URL}`,
  "--var TURNSTILE_ALLOWED_HOSTS:localhost,127.0.0.1,b2b-preview.example.workers.dev",
].join(" ");
afterEach(() => {
  vi.useRealTimers();
});

// 每个文件只建一次 git 仓库，各 fixture 复制它的 .git；脚本内部仍运行真实 git。
let gitTemplate: { dir: string; commitSha: string } | undefined;
function getGitTemplate() {
  if (gitTemplate) return gitTemplate;
  const dir = mkdtempSync(path.join(os.tmpdir(), FIXTURE_PREFIX));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
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
  gitTemplate = { dir, commitSha: git("rev-parse", "HEAD") };
  return gitTemplate;
}

// 子进程边界上的替身：假的 pnpm / node 只记录调用顺序并按环境变量输出，
// 证明通道本身（含 git）仍是真实进程。
function createProofFixture() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), FIXTURE_PREFIX));

  // 脚本运行时只读取自身、同目录的产物检查、收录检查和页面注册表。
  for (const repoPath of [
    "scripts/quality/checks/cloudflare-smoke.js",
    "scripts/quality/checks/cloudflare-artifact-config.js",
    "scripts/quality/checks/robots-indexing.js",
    "src/config/pages.config.ts",
  ]) {
    mkdirSync(path.dirname(path.join(rootDir, repoPath)), { recursive: true });
    copyFileSync(path.resolve(repoPath), path.join(rootDir, repoPath));
  }

  const binDir = path.join(rootDir, "bin");
  mkdirSync(binDir);
  const callLog = path.join(rootDir, "calls.log");
  const buildEnvLog = path.join(rootDir, "build-env.log");
  const fakePnpm = [
    "#!/bin/sh",
    'echo "pnpm $*" >> "$FAKE_CALL_LOG"',
    'case "$1" in',
    '  website:build:cf) echo "$NEXT_PUBLIC_BASE_URL $NEXT_PUBLIC_SITE_URL" >> "$FAKE_BUILD_ENV_LOG"; if [ -n "$FAKE_NEXT_ENV" ]; then mkdir -p .open-next/cloudflare && printf "%s\\n" "$FAKE_NEXT_ENV" > .open-next/cloudflare/next-env.mjs; fi; printf "%s\\n" "$FAKE_BUILD_OUTPUT"; exit "${FAKE_BUILD_EXIT:-0}" ;;',
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

  cpSync(path.join(getGitTemplate().dir, ".git"), path.join(rootDir, ".git"), {
    recursive: true,
  });

  return {
    binDir,
    commitSha: getGitTemplate().commitSha,
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

  // 两个入口各跑一次完整子进程；逐项的 URL 拒绝规则在下方进程内覆盖。
  it.each([
    ["--base-url", ["--base-url", "https://$(reviewprobe).example.com"], {}],
    [
      "DEPLOY_SMOKE_BASE_URL",
      [],
      { DEPLOY_SMOKE_BASE_URL: "https://example.invalid" },
    ],
  ])(
    "blocks before building or deploying when %s carries a refused URL",
    (_entry, args, env) => {
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
    },
  );

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
  ])("refuses a preview URL with %s", (_label, raw) => {
    expect(parseCloudflarePreviewUrl(raw)).toBeNull();
  });

  it.each([PREVIEW_URL, `${PREVIEW_URL}/`])(
    "accepts the plain https preview URL %s",
    (raw) => {
      expect(parseCloudflarePreviewUrl(raw)?.origin).toBe(PREVIEW_URL);
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

  it("blocks without deploying when local env files baked private values into the build", () => {
    const fixture = createProofFixture();

    const result = fixture.runLane({
      FAKE_NEXT_ENV: [
        'export const production = {"NEXT_PUBLIC_SITE_URL":"https://a.example","RESEND_API_KEY":"re_secret"};',
        'export const development = {"AIRTABLE_API_KEY":"pat_secret"};',
        "export const test = {};",
      ].join("\n"),
    });

    expect(result.status).toBe(2);
    expect(fixture.readCalls()).toEqual(["pnpm website:build:cf"]);
    const proof = fixture.readProof();
    expect(proof).toMatchObject({ status: "blocked", stage: "env-files" });
    expect(String(proof.reason)).toContain("AIRTABLE_API_KEY, RESEND_API_KEY");
    expect(JSON.stringify(proof)).not.toContain("secret");
  });

  it("deploys when the bundled env files carry only public values", () => {
    const fixture = createProofFixture();

    fixture.runLane({
      FAKE_NEXT_ENV:
        'export const production = {"NEXT_PUBLIC_SITE_URL":"https://a.example"};',
    });

    expect(fixture.readCalls()).toContain(
      `pnpm exec opennextjs-cloudflare deploy --env preview --keep-vars --var NEXT_PUBLIC_BASE_URL:${PREVIEW_URL} --var NEXT_PUBLIC_SITE_URL:${PREVIEW_URL} --var TURNSTILE_ALLOWED_HOSTS:localhost,127.0.0.1,b2b-preview.example.workers.dev`,
    );
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
  it("kills wrapper descendants when the command times out", async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), FIXTURE_PREFIX));
    const ready = path.join(rootDir, "ready");
    // 只假冒超时计时器；子进程、管道与信号都是真实的。
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    // 孙进程存活 30 秒（长于用例超时）并一直持有 stdout 管道：只杀掉 sh 时 close
    // 不会触发、用例会超时失败，所以 promise 能结算即证明整个进程组已被杀掉。
    const pending = runChildCommand(
      "sh",
      [
        "-c",
        '"$1" -e "$2" "$3" & wait',
        "wrapper",
        process.execPath,
        'process.stdout.write("ready", () => require("node:fs").writeFileSync(process.argv[1], "")); setTimeout(() => {}, 30000)',
        ready,
      ],
      700,
    );
    while (!existsSync(ready)) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    vi.advanceTimersByTime(700);
    const result = await pending;

    expect(result.stdout).toBe("ready");
    expect((result.error as NodeJS.ErrnoException | undefined)?.code).toBe(
      "ETIMEDOUT",
    );
    expect(result.status).toBeNull();
    expect(result.signal).toBe("SIGKILL");
  });
});
