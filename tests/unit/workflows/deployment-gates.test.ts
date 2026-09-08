import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { spawnSync } from "node:child_process";
import { load } from "js-yaml";
import { describe, expect, it, vi } from "vitest";

interface Step {
  name: string;
  run?: string;
  if?: string;
  with?: { script?: string };
}
const workflow = load(
  readFileSync(".github/workflows/cloudflare-deploy.yml", "utf8"),
) as {
  jobs: Record<string, { steps: Step[] }>;
};
const steps = workflow.jobs["build-and-deploy"]!.steps;

describe("production admission", () => {
  it("rejects missing Worker secrets using the deployed secret inventory, not GitHub env", () => {
    const run = steps.find(
      (step) => step.name === "阻断：Worker production secret 名称齐备",
    )!.run!;
    const script = run.split("node <<'NODE'\n")[1]!.split("\nNODE")[0]!;
    const names = [
      "RATE_LIMIT_PEPPER",
      "TURNSTILE_SECRET_KEY",
      "EMAIL_FROM",
      "INQUIRY_RECIPIENT_EMAIL",
      "RESEND_API_KEY",
      "AIRTABLE_API_KEY",
      "AIRTABLE_BASE_ID",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
    ];
    const execute = (inventory: string[]) =>
      runInNewContext(
        script,
        {
          require: () => ({
            readFileSync: () =>
              JSON.stringify(inventory.map((name) => ({ name }))),
          }),
          process: { env: { RUNNER_TEMP: "/tmp" } },
          console: { log: vi.fn() },
        },
        { timeout: 1000 },
      );
    expect(() => execute(names)).not.toThrow();
    expect(() =>
      execute(names.filter((name) => name !== "RESEND_API_KEY")),
    ).toThrow("Missing Worker secrets: RESEND_API_KEY");
  });
  it("rejects a tag called main and other branches before deployment", () => {
    const script = steps.find(
      (step) => step.name === "阻断：production 只能从 main 部署",
    )!.run!;
    for (const ref of [
      "refs/tags/main",
      "refs/heads/feature",
      "refs/heads/main",
    ]) {
      const result = spawnSync("bash", ["-c", script], {
        env: { ...process.env, GITHUB_REF: ref, GITHUB_REF_NAME: "main" },
        timeout: 5000,
      });
      expect(result.status).toBe(ref === "refs/heads/main" ? 0 : 1);
    }
  });

  it("requires the latest main push CI result for exactly the deployed SHA", async () => {
    const script = steps.find(
      (step) => step.name === "阻断：当前提交必须通过 main CI",
    )!.with!.script!;
    // 执行 YAML 中的真实检查，替换网络而非检查逻辑。
    // eslint-disable-next-line no-new-func -- 执行已检入的 workflow 检查，不执行网络输入。
    const execute = new Function(
      "github",
      "context",
      "core",
      `return (async () => { ${script} })()`,
    );
    for (const run of [
      undefined,
      { head_sha: "other", conclusion: "success" },
      { head_sha: "target", conclusion: "failure" },
      { head_sha: "target", conclusion: null },
      { head_sha: "target", conclusion: "success" },
    ]) {
      const listWorkflowRuns = vi
        .fn()
        .mockResolvedValue({ data: { workflow_runs: run ? [run] : [] } });
      const setFailed = vi.fn();
      await execute(
        { rest: { actions: { listWorkflowRuns } } },
        { repo: { owner: "owner", repo: "repo" }, sha: "target" },
        { setFailed },
      );
      expect(listWorkflowRuns).toHaveBeenCalledWith(
        expect.objectContaining({
          workflow_id: "ci.yml",
          head_sha: "target",
          branch: "main",
          event: "push",
          per_page: 1,
        }),
      );
      expect(setFailed).toHaveBeenCalledTimes(
        run?.head_sha === "target" && run.conclusion === "success" ? 0 : 1,
      );
    }
  });
});
