import { existsSync, readFileSync } from "node:fs";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

const CI_WORKFLOW_PATH = ".github/workflows/ci.yml";
const LEFTHOOK_CONFIG_PATH = "lefthook.yml";
const PRETTIER_CONFIG_PATH = "prettier.config.mjs";
const SEMGREP_CONFIG_PATH = "semgrep.yml";
// Vitest 已覆盖治理测试；CI 只需额外运行 scanner 和 Storybook build。
const COMPONENT_PROOF_COMMANDS = [
  "pnpm component:governance",
  "pnpm exec storybook build",
] as const;
const FULL_COMPONENT_CHECK_COMMAND = "pnpm component:check";
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

function getQualityJob(workflow: string): string {
  const qualityStart = workflow.indexOf("  quality:");
  const testsStart = workflow.indexOf("\n  tests:", qualityStart);

  expect(qualityStart, "quality job must exist in CI workflow").toBeGreaterThan(
    -1,
  );
  expect(testsStart, "tests job must follow quality job").toBeGreaterThan(
    qualityStart,
  );

  return workflow.slice(qualityStart, testsStart);
}

describe("CI workflow contract", () => {
  it("runs component governance and Storybook build in the quality job", () => {
    const workflow = readCiWorkflow();
    const qualityJob = getQualityJob(workflow);

    for (const command of COMPONENT_PROOF_COMMANDS) {
      expect(qualityJob).toContain(command);
    }

    expect(qualityJob).not.toContain(FULL_COMPONENT_CHECK_COMMAND);
  });

  it("runs an honestly named preview configuration smoke in the quality job", () => {
    const qualitySteps = readCiWorkflowConfig().jobs?.quality?.steps ?? [];

    expect(qualitySteps).toContainEqual({
      name: "preview config smoke",
      run: "APP_ENV=preview node scripts/starter-checks.js validate-production-config",
    });
  });

  // 这两个对账门必须接入真实 CI 车道，才能证明自身和测试收集面。
  it("keeps the standalone gate checks wired to a lane that actually runs", () => {
    const qualityRuns = (readCiWorkflowConfig().jobs?.quality?.steps ?? [])
      .map((step) => step.run?.trim())
      .filter((run): run is string => Boolean(run));

    for (const command of [
      "node scripts/starter-checks.js vitest-collection",
      "node scripts/starter-checks.js subcommand-lanes",
    ]) {
      expect(qualityRuns).toContain(command);
    }
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
    expect(includes).toContain("src/app/api/inquiry/route.ts");
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

  it("declares the Tailwind Prettier plugin explicitly", () => {
    expect(existsSync(PRETTIER_CONFIG_PATH)).toBe(true);
    expect(readRepoFile(PRETTIER_CONFIG_PATH)).toContain(
      "prettier-plugin-tailwindcss",
    );
  });
});
