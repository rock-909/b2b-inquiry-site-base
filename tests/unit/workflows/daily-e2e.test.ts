import { existsSync, readFileSync } from "node:fs";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

interface WorkflowStep {
  readonly name?: string;
  readonly run?: string;
  readonly uses?: string;
  readonly env?: Record<string, string>;
}

interface Workflow {
  readonly on?: {
    readonly schedule?: readonly { readonly cron?: string }[];
  };
  readonly permissions?: Record<string, string>;
  readonly jobs?: Record<string, { readonly steps?: readonly WorkflowStep[] }>;
}

describe("daily E2E proof lane", () => {
  it("runs the coverage-mapped browser specs every day", () => {
    const workflow = load(
      readFileSync(".github/workflows/daily-e2e.yml", "utf8"),
    ) as Workflow;
    const steps = workflow.jobs?.e2e?.steps ?? [];
    const buildStep = steps.find(
      (step) => step.name === "Build production app",
    );
    const testStep = steps.find((step) => step.name === "Run daily E2E");

    expect(workflow.on?.schedule).toEqual([{ cron: "0 10 * * *" }]);
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(testStep?.env).toMatchObject({
      CI_DAILY: "true",
      CI_FLAKE_SAMPLING: "1",
      PLAYWRIGHT_PROFILE_LANE: "all",
    });
    expect(buildStep?.env).toMatchObject({
      SECURITY_HEADERS_ENABLED: "false",
    });

    // 这里以前钉死 7 个文件名。它守住的是清单，不是覆盖面：ci.yml 点名 4 个、
    // 这里点名 7 个、playwright.config 白名单 5 个，三份都不一样，于是有 3 个
    // 用例文件哪个 workflow 都没跑。现在守"这一步不按文件过滤"。
    expect(testStep?.run?.trim()).toBe("pnpm exec playwright test");
    expect(existsSync("tests/e2e")).toBe(true);
  });

  // 这里以前还钉着 ci.yml 里的 "Lead API family proof" 步骤。那一步在
  // pnpm test 后面把同一个文件再跑一遍——tests/integration/** 本来就在 vitest
  // include 里，没有多出任何覆盖。步骤和这条断言一起退役于 2026-07-26。
});
