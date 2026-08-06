import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

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

  it("opens one real issue and still fails when the audit step fails", () => {
    const auditStep = requireStep((step) => step.id === "audit");
    const issueStep = requireStep(
      (step) => step.name === "Open dependency audit issue",
    );
    const failStep = requireStep(
      (step) => step.name === "Fail when the dependency audit step fails",
    );

    expect(auditStep).toMatchObject({
      "continue-on-error": true,
      run: "pnpm audit --prod --audit-level moderate",
    });
    expect(issueStep).toMatchObject({
      if: "steps.audit.outcome == 'failure'",
      uses: "actions/github-script@v8",
    });
    expect(issueStep.with?.script).toContain(
      'const title = "Weekly production dependency audit failed"',
    );
    expect(issueStep.with?.script).toContain(
      "github.paginate(github.rest.issues.listForRepo",
    );
    expect(issueStep.with?.script).toContain(
      "!issue.pull_request && issue.title === title",
    );
    expect(issueStep.with?.script).toContain("github.rest.issues.create({");
    expect(issueStep.with?.script).toContain("title,\n");
    expect(failStep).toEqual(
      expect.objectContaining({
        if: "${{ !cancelled() && steps.audit.outcome == 'failure' }}",
        run: "exit 1",
      }),
    );
    expect(steps.indexOf(issueStep)).toBeGreaterThan(steps.indexOf(auditStep));
    expect(steps.indexOf(failStep)).toBeGreaterThan(steps.indexOf(issueStep));
  });
});
