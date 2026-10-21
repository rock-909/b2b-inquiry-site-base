import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { describe, expect, it, vi } from "vitest";

interface WorkflowStep {
  readonly name?: string;
  readonly id?: string;
  readonly if?: string;
  readonly run?: string;
  readonly uses?: string;
  readonly "continue-on-error"?: boolean;
  readonly env?: Record<string, string>;
  readonly with?: {
    readonly script?: string;
  };
}

interface WeeklyAuditWorkflow {
  readonly on?: {
    readonly schedule?: readonly { readonly cron?: string }[];
  };
  readonly permissions?: Record<string, string>;
  readonly concurrency?: {
    readonly group?: string;
    readonly "cancel-in-progress"?: boolean;
  };
  readonly jobs?: {
    readonly audit?: {
      readonly steps?: readonly WorkflowStep[];
    };
  };
}

const workflow = load(
  readFileSync(".github/workflows/weekly-audit.yml", "utf8"),
) as WeeklyAuditWorkflow;
const steps = workflow.jobs?.audit?.steps ?? [];

function requireStep(predicate: (step: WorkflowStep) => boolean): WorkflowStep {
  const step = steps.find(predicate);
  if (!step) {
    throw new Error("Required weekly audit workflow step is missing");
  }
  return step;
}

describe("weekly dependency audit workflow", () => {
  it("runs the production audit on a schedule with least-privilege permissions", () => {
    // 具体 cron 和并发组名是派生站可改的模板值，不是契约。
    expect(workflow.on?.schedule?.[0]?.cron).toEqual(expect.any(String));
    expect(workflow.permissions).toEqual({
      contents: "read",
      issues: "write",
    });
    expect(workflow.concurrency?.["cancel-in-progress"]).toBe(false);
  });

  it("syncs the issue on a real audit outcome, then fails the job on failure", () => {
    const auditStep = requireStep((step) => step.id === "audit");
    const issueStep = requireStep(
      (step) => step.uses?.startsWith("actions/github-script@") === true,
    );
    const failStep = requireStep((step) => step.run === "exit 1");

    expect(auditStep).toMatchObject({
      "continue-on-error": true,
      run: "pnpm audit --prod --audit-level moderate",
    });
    // 安装失败时 audit 为 skipped，不能被当成恢复而关闭 issue。
    expect(issueStep).toMatchObject({
      if: "${{ !cancelled() && (steps.audit.outcome == 'failure' || steps.audit.outcome == 'success') }}",
      env: { AUDIT_OUTCOME: "${{ steps.audit.outcome }}" },
    });
    expect(failStep).toEqual(
      expect.objectContaining({
        if: "${{ !cancelled() && steps.audit.outcome == 'failure' }}",
        run: "exit 1",
      }),
    );
    expect(steps.indexOf(issueStep)).toBeGreaterThan(steps.indexOf(auditStep));
    expect(steps.indexOf(failStep)).toBeGreaterThan(steps.indexOf(issueStep));
  });

  it("opens or comments on failure and closes the issue on recovery", async () => {
    const script = requireStep(
      (step) => step.uses?.startsWith("actions/github-script@") === true,
    ).with?.script;
    if (!script) {
      throw new Error("Weekly audit issue step has no script");
    }
    // 执行 YAML 中的真实脚本，只替换 GitHub 客户端和步骤环境变量。
    /* eslint-disable no-new-func -- 仅执行已检入的 workflow 脚本，不执行网络输入。 */
    // nosemgrep: unsafe-eval-usage -- 执行仓库 workflow，外部 API 全部为测试桩。
    const execute = new Function(
      "github",
      "context",
      "core",
      "process",
      `return (async () => { ${script} })()`,
    );
    /* eslint-enable no-new-func -- workflow 执行器以外恢复禁令。 */
    const title = "Weekly production dependency audit failed";
    const runUrl = "https://github.example/owner/repo/actions/runs/42";
    const context = {
      repo: { owner: "owner", repo: "repo" },
      serverUrl: "https://github.example",
      runId: 42,
    };
    const openIssue = { number: 54, title };
    const pullRequest = { number: 7, title, pull_request: {} };
    const otherIssue = { number: 8, title: "Something else" };
    const cases = [
      { outcome: "failure", existing: [], calls: ["create"] },
      { outcome: "failure", existing: [openIssue], calls: ["comment 54"] },
      { outcome: "failure", existing: [pullRequest], calls: ["create"] },
      { outcome: "failure", existing: [otherIssue], calls: ["create"] },
      {
        outcome: "success",
        existing: [openIssue, otherIssue, pullRequest],
        calls: ["comment 54", "close 54"],
      },
      { outcome: "success", existing: [], calls: [] },
    ];

    for (const { outcome, existing, calls: expectedCalls } of cases) {
      const name = `${outcome} with ${JSON.stringify(existing)}`;
      const calls: string[] = [];
      const bodies: string[] = [];
      const listForRepo = vi.fn();
      const paginate = vi.fn().mockResolvedValue(existing);
      const issues = {
        listForRepo,
        create: vi.fn(async (args: { title: string; body: string }) => {
          expect(args.title, name).toBe(title);
          calls.push("create");
          bodies.push(args.body);
        }),
        createComment: vi.fn(
          async (args: { issue_number: number; body: string }) => {
            calls.push(`comment ${args.issue_number}`);
            bodies.push(args.body);
          },
        ),
        update: vi.fn(async (args: { issue_number: number; state: string }) => {
          calls.push(
            `${args.state === "closed" ? "close" : "update"} ${args.issue_number}`,
          );
        }),
      };
      await execute(
        { paginate, rest: { issues } },
        context,
        {},
        {
          env: { AUDIT_OUTCOME: outcome },
        },
      );
      expect(paginate, name).toHaveBeenCalledWith(
        listForRepo,
        expect.objectContaining({
          owner: "owner",
          repo: "repo",
          state: "open",
        }),
      );
      expect(calls, name).toEqual(expectedCalls);
      for (const body of bodies) {
        expect(body, name).toContain(runUrl);
      }
    }
  });
});
