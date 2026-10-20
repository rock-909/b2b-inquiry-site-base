import { existsSync, readdirSync, readFileSync } from "node:fs";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

const CI_WORKFLOW_PATH = ".github/workflows/ci.yml";
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

/**
 * 返回 run 中真正会被 shell 执行的行：跳过 heredoc 体（<<'EOF' … EOF）。
 * heredoc 内的文本只是数据，不能作为「步骤执行了某命令」的证据——否则
 * 把目标命令写进一个从不执行的 heredoc 就能骗过锚定匹配。
 */
function executableLines(run: string): string[] {
  const lines: string[] = [];
  let heredocEnd: string | null = null;

  for (const line of run.split("\n")) {
    if (heredocEnd !== null) {
      if (line.trim() === heredocEnd) {
        heredocEnd = null;
      }
      continue;
    }

    const heredocStart = /<<-?\s*["']?(\w+)["']?/u.exec(line);
    if (heredocStart) {
      heredocEnd = heredocStart[1] ?? null;
    }
    lines.push(line.trim());
  }

  return lines.filter((line) => line.length > 0);
}

describe("CI workflow contract", () => {
  // 任何 workflow 的第三方 action 都必须固定到完整 commit SHA，避免浮动 tag 被改写后进入 CI。
  it("pins every workflow action to a full commit SHA", () => {
    const workflowDir = ".github/workflows";
    const files = readdirSync(workflowDir).filter((name) =>
      /\.ya?ml$/u.test(name),
    );
    const unpinned = files.flatMap((file) => {
      const workflow = load(readRepoFile(`${workflowDir}/${file}`)) as {
        jobs?: Record<string, { steps?: readonly { uses?: string }[] }>;
      };
      return Object.values(workflow.jobs ?? {})
        .flatMap((job) => job.steps ?? [])
        .map((step) => step.uses)
        .filter((uses): uses is string => uses !== undefined)
        .filter((uses) => !/@[0-9a-f]{40}$/u.test(uses))
        .map((uses) => `${file}: ${uses}`);
    });

    expect(files.length).toBeGreaterThan(0);
    expect(unpinned).toEqual([]);
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

  it("runs the whole-repository Prettier gate in CI", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      scripts?: Record<string, string>;
    };
    const qualitySteps = readCiWorkflowConfig().jobs?.quality?.steps ?? [];

    expect(packageJson.scripts?.["format:check"]).toBe("prettier --check .");
    expect(
      qualitySteps.some((step) =>
        executableLines(step.run ?? "").includes("pnpm format:check"),
      ),
    ).toBe(true);
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
    // 路由被移动或改名后，规则会静默指向不存在的文件；Semgrep 不会因此报错。
    expect(existsSync("src/app/api/inquiry/route.ts")).toBe(true); // nosemgrep: test-no-file-existence-assertion -- 校验 Semgrep 规则路径指向真实文件，规则本身不会对不存在的路径报错。
  });
});
