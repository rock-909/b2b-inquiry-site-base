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
  it("runs the production audit every Monday with the required permissions", () => {
    expect(workflow.on?.schedule).toEqual([{ cron: "0 9 * * 1" }]);
    expect(workflow.permissions).toEqual({
      contents: "read",
      issues: "write",
    });
    expect(workflow.concurrency).toEqual({
      group: "weekly-production-dependency-audit",
      "cancel-in-progress": false,
    });
  });

  it("gates the issue and the failing exit on the audit outcome, in order", () => {
    const auditStep = requireStep((step) => step.id === "audit");
    const issueStep = requireStep(
      (step) => step.uses === "actions/github-script@v8",
    );
    const failStep = requireStep((step) => step.run === "exit 1");

    expect(auditStep).toMatchObject({
      "continue-on-error": true,
      run: "pnpm audit --prod --audit-level moderate",
    });
    expect(issueStep).toMatchObject({
      if: "steps.audit.outcome == 'failure'",
      uses: "actions/github-script@v8",
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

  it("opens an issue only when no open issue already carries the title", async () => {
    const script = requireStep(
      (step) => step.uses === "actions/github-script@v8",
    ).with?.script;
    if (!script) {
      throw new Error("Weekly audit issue step has no script");
    }
    // 执行 YAML 中的真实脚本，只替换 GitHub 客户端。
    // eslint-disable-next-line no-new-func -- 执行已检入的 workflow 脚本，不执行网络输入。
    const execute = new Function(
      "github",
      "context",
      "core",
      `return (async () => { ${script} })()`,
    );
    const title = "Weekly production dependency audit failed";
    const context = {
      repo: { owner: "owner", repo: "repo" },
      serverUrl: "https://github.example",
      runId: 42,
    };
    const cases = [
      { name: "no open issue", existing: [], creates: 1 },
      {
        name: "open issue with the same title",
        existing: [{ title }],
        creates: 0,
      },
      {
        name: "pull request with the same title",
        existing: [{ title, pull_request: {} }],
        creates: 1,
      },
      {
        name: "open issue with another title",
        existing: [{ title: "Something else" }],
        creates: 1,
      },
    ];

    for (const { name, existing, creates } of cases) {
      const listForRepo = vi.fn();
      const create = vi.fn().mockResolvedValue({});
      const paginate = vi.fn().mockResolvedValue(existing);
      await execute(
        { paginate, rest: { issues: { listForRepo, create } } },
        context,
        {},
      );
      expect(paginate, name).toHaveBeenCalledWith(
        listForRepo,
        expect.objectContaining({
          owner: "owner",
          repo: "repo",
          state: "open",
        }),
      );
      expect(create, name).toHaveBeenCalledTimes(creates);
      if (creates > 0) {
        expect(create, name).toHaveBeenCalledWith({
          owner: "owner",
          repo: "repo",
          title,
          body: expect.stringContaining(
            "https://github.example/owner/repo/actions/runs/42",
          ),
        });
      }
    }
  });
});
