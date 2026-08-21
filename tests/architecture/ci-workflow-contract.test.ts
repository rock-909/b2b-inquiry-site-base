import { existsSync, readFileSync } from "node:fs";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

const CI_WORKFLOW_PATH = ".github/workflows/ci.yml";
const LEFTHOOK_CONFIG_PATH = "lefthook.yml";
const PRETTIER_CONFIG_PATH = "prettier.config.mjs";
const SEMGREP_CONFIG_PATH = "semgrep.yml";
interface SemgrepRulePaths {
  readonly include?: readonly string[];
  readonly exclude?: readonly string[];
}

interface SemgrepRule {
  readonly id: string;
  readonly severity?: string;
  readonly paths?: SemgrepRulePaths;
}

interface WorkflowStep {
  readonly "continue-on-error"?: boolean;
  readonly name?: string;
  readonly run?: string;
}

interface CiJob {
  readonly "continue-on-error"?: boolean;
  readonly steps?: readonly WorkflowStep[];
}

interface CiWorkflow {
  readonly jobs?: Record<string, CiJob | undefined>;
}

interface LefthookConfig {
  readonly "pre-commit"?: {
    readonly commands?: Record<string, { readonly run?: string }>;
  };
  readonly "pre-push"?: {
    readonly commands?: Record<string, { readonly run?: string }>;
  };
}

interface SemgrepConfig {
  readonly rules?: readonly SemgrepRule[];
}

function readCiWorkflow(): string {
  return readFileSync(CI_WORKFLOW_PATH, "utf8");
}

function readRepoFile(relativePath: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test reads fixed repo config paths
  return readFileSync(relativePath, "utf8");
}

function readSemgrepConfig(): SemgrepConfig {
  return load(readRepoFile(SEMGREP_CONFIG_PATH)) as SemgrepConfig;
}

function readCiWorkflowConfig(): CiWorkflow {
  return load(readCiWorkflow()) as CiWorkflow;
}

function readLefthookConfig(): LefthookConfig {
  return load(readRepoFile(LEFTHOOK_CONFIG_PATH)) as LefthookConfig;
}

/** Every `run:` command a parsed workflow/hook config would actually execute. */
function collectRunCommands(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) collectRunCommands(item, found);
    return found;
  }

  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "run" && typeof value === "string") found.push(value);
      else collectRunCommands(value, found);
    }
  }

  return found;
}

describe("CI workflow contract", () => {
  it("runs an honestly named preview configuration smoke in the quality job", () => {
    const qualitySteps = readCiWorkflowConfig().jobs?.quality?.steps ?? [];
    // 语义定位：跑的是 preview 档位的配置冒烟，而不是逐字锁步骤名和命令串——
    // 措辞迭代不该红，命令片段和档位才是契约。
    const smoke = qualitySteps.find(
      (step) =>
        step.run?.includes("production-config.js") &&
        step.run.includes("APP_ENV=preview"),
    );

    expect(smoke, "preview config smoke step must exist").toBeDefined();
    expect(smoke?.name).toMatch(/preview/iu);
  });

  // CI 作业和步骤都必须传播失败；其他工作流有自己的契约。
  it("keeps no ci.yml step or job that can never fail", () => {
    const jobs = Object.entries(readCiWorkflowConfig().jobs ?? {});
    const escapes = jobs.flatMap(([jobName, job]) => [
      ...(job?.["continue-on-error"] === true ? [`job:${jobName}`] : []),
      ...(job?.steps ?? [])
        .filter((step) => step["continue-on-error"] === true)
        .map((step) => `${jobName}/${step.name ?? step.run ?? "?"}`),
    ]);

    expect(jobs.length).toBeGreaterThan(0);
    expect(escapes).toEqual([]);
  });

  // 安全扫描必须覆盖整个仓库，包括执行中的脚本和根配置。
  it("scans the whole repository, not a hand-picked subset", () => {
    const command = readCiWorkflow()
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("run: semgrep scan"));

    expect(command).toBeDefined();

    // `semgrep scan [flags] <targets...>`：跳过 flag 和带值 flag 的值，剩下的是目标。
    const tokens = (command ?? "").replace(/^run:\s*/u, "").split(/\s+/u);
    const flagsTakingValue = new Set(["--config", "--severity"]);
    const targets: string[] = [];
    for (let index = 2; index < tokens.length; index += 1) {
      const token = tokens[index] ?? "";
      if (flagsTakingValue.has(token)) {
        index += 1;
        continue;
      }
      if (token.startsWith("--")) continue;
      targets.push(token);
    }

    expect(targets).toEqual(["."]);
  });

  // CI scans with `--severity ERROR`, so any rule below that severity is dead
  // weight that still reads as coverage. A frozen ID list used to stand here; it
  // only made adding a real rule fail, and never caught a demoted one.
  it("keeps every Semgrep rule at the severity CI actually scans", () => {
    const rules = readSemgrepConfig().rules ?? [];
    const belowCiFloor = rules
      .filter((rule) => rule.severity !== "ERROR")
      .map((rule) => rule.id);

    expect(rules.length).toBeGreaterThan(0);
    expect(belowCiFloor).toEqual([]);
  });

  it("scopes safeParseJson enforcement to the inquiry lead writer only", () => {
    const semgrepConfig = readSemgrepConfig();
    const rule = (semgrepConfig.rules ?? []).find(
      (entry) => entry.id === "starter-lead-route-missing-safe-json-body",
    );
    const includes = rule?.paths?.include ?? [];

    expect(rule, "lead safe-json Semgrep rule must exist").toBeDefined();
    // 「only」是契约的一半：规则必须命中 lead writer，且不得外溢到其他文件。
    expect(includes).toEqual(["src/app/api/inquiry/route.ts"]);
  });

  it("keeps Lighthouse as a manual performance proof", () => {
    const automated = [
      ...collectRunCommands(load(readCiWorkflow())),
      ...collectRunCommands(load(readRepoFile(LEFTHOOK_CONFIG_PATH))),
    ];

    expect(automated.length).toBeGreaterThan(0);
    expect(
      automated.filter((command) => /lighthouse|lhci/iu.test(command)),
    ).toEqual([]);
  });

  it("keeps local Git hooks narrow and leaves broad scans to CI or release", () => {
    const config = readLefthookConfig();
    const preCommit = config["pre-commit"]?.commands ?? {};
    const prePush = config["pre-push"]?.commands ?? {};
    const hookCommands = collectRunCommands(config).join("\n");

    // 钩子窄职责的实质由两条边界守住：必需检查必须在场，broad scan 必须不在。
    // 不再要求键名清单逐项全等：新增一个快速合法钩子不应让契约变红。
    for (const key of ["format-check", "i18n-sync"]) {
      expect(preCommit[key], `pre-commit.${key} should stay`).toBeDefined();
    }
    for (const key of ["type-check", "tests", "build-check"]) {
      expect(prePush[key], `pre-push.${key} should stay`).toBeDefined();
    }
    expect(prePush["type-check"]?.run).toContain("pnpm type-check:tests");
    expect(prePush.tests?.run).toContain("pnpm test");
    expect(prePush["build-check"]?.run).toContain("pnpm build");
    expect(hookCommands).not.toMatch(
      /RUN_FAST_PUSH|dependency-cruiser|pnpm audit|knip:check|semgrep|website:build:cf|playwright/iu,
    );
  });

  it("declares the Tailwind Prettier plugin explicitly", () => {
    expect(existsSync(PRETTIER_CONFIG_PATH)).toBe(true);
    expect(readRepoFile(PRETTIER_CONFIG_PATH)).toContain(
      "prettier-plugin-tailwindcss",
    );
  });
});
