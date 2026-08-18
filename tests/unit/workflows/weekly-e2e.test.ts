import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

interface WorkflowStep {
  readonly run?: string;
  readonly env?: Record<string, string>;
}

interface Workflow {
  readonly on?: {
    readonly schedule?: readonly { readonly cron?: string }[];
  };
  readonly permissions?: Record<string, string>;
  readonly jobs?: Record<string, { readonly steps?: readonly WorkflowStep[] }>;
}

describe("weekly browser matrix", () => {
  it("runs the full browser coverage lane weekly with zero retries", () => {
    const workflow = load(
      readFileSync(".github/workflows/weekly-e2e.yml", "utf8"),
    ) as Workflow;
    const steps = workflow.jobs?.e2e?.steps ?? [];
    const buildStep = steps.find((step) => step.run === "pnpm build");
    const testStep = steps.find(
      (step) => step.run === "pnpm exec playwright test",
    );

    expect(workflow.on?.schedule).toEqual([{ cron: "0 10 * * 1" }]);
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(testStep?.env).toMatchObject({
      CI_FULL_COVERAGE: "true",
      CI_FLAKE_SAMPLING: "1",
      PLAYWRIGHT_PROFILE_LANE: "all",
    });
    expect(buildStep?.env).toMatchObject({
      SECURITY_HEADERS_ENABLED: "false",
    });
  });
});
