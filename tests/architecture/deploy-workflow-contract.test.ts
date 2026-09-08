import { readFileSync } from "node:fs";

import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

interface DeployWorkflow {
  readonly concurrency?: {
    readonly "cancel-in-progress"?: boolean | string;
  };
  readonly jobs?: Record<
    string,
    {
      readonly needs?: string | readonly string[];
      readonly "continue-on-error"?: boolean;
      readonly steps?: readonly {
        readonly id?: string;
        readonly if?: string;
        readonly name?: string;
        readonly run?: string;
        readonly uses?: string;
        readonly with?: Record<string, string>;
        readonly env?: Record<string, string>;
        readonly "continue-on-error"?: boolean;
      }[];
    }
  >;
}

function loadDeployWorkflow(): DeployWorkflow {
  return load(
    readFileSync(".github/workflows/cloudflare-deploy.yml", "utf8"),
  ) as DeployWorkflow;
}

function normalizeNeeds(
  needs: string | readonly string[] | undefined,
): string[] {
  if (needs === undefined) return [];
  return Array.isArray(needs) ? [...needs] : [needs as string];
}

describe("Cloudflare deploy workflow contract", () => {
  it("runs strict production gates before deployment", () => {
    const steps = workflowSteps(loadDeployWorkflow(), "build-and-deploy");
    const configGateIndex = findStepIndex(
      steps,
      "scripts/quality/checks/production-config.js",
    );
    const configGate = steps[configGateIndex];
    const deploy = steps.findIndex((step) => step.id === "deploy_production");
    const deployStep = steps[deploy];

    expect(configGateIndex).toBeGreaterThanOrEqual(0);
    // 生产门禁必须是严格档位，不是普通检查重跑一遍。
    expect(configGate?.run).toContain("PUBLIC_LAUNCH_STRICT=true");
    expect(configGate?.run).toContain("APP_ENV=production");
    expect(deploy).toBeGreaterThan(configGateIndex);
    expect(deployStep?.if).toContain("inputs.environment == 'production'");
    expect(deployStep?.run).toContain(
      "pnpm exec opennextjs-cloudflare deploy --env production",
    );
    expect(deployStep?.run).not.toContain("--env preview");
  });

  it("deploys the Cloudflare artifact already built by release proof", () => {
    const workflow = loadDeployWorkflow();
    const steps = workflowSteps(workflow, "build-and-deploy");
    const releaseProof = steps.find((step) =>
      step.run?.includes("pnpm release:verify"),
    );

    expect(releaseProof?.run).toContain(
      "pnpm release:verify --env production 2>&1 | tee cf_build.log",
    );
    // 单次构建是全 workflow 的约束，不只是 build-and-deploy 这个 job——
    // 别的 job 里偷偕再建一次也要红。
    const allSteps = Object.values(workflow.jobs ?? {}).flatMap(
      (job) => job?.steps ?? [],
    );
    expect(
      allSteps.filter((step) => step.run?.includes("pnpm website:build:cf")),
    ).toHaveLength(0);
  });

  it("keeps post-deploy verification serialized after the deploy job", () => {
    const workflow = loadDeployWorkflow();
    const buildSteps = workflowSteps(workflow, "build-and-deploy");
    const smokeStep = workflowSteps(workflow, "post-deploy-verification").find(
      (step) => step.run?.includes("cloudflare-smoke.js deployed-smoke"),
    );
    const deployStep = buildSteps.find(
      (step) => step.id === "deploy_production",
    );

    expect(
      normalizeNeeds(workflow.jobs?.["post-deploy-verification"]?.needs),
    ).toContain("build-and-deploy");
    expect(smokeStep?.run).toContain(
      "needs.build-and-deploy.outputs.deployment_url",
    );
    expect(deployStep?.run).toContain("worker-url=${DEPLOY_URL}");
  });

  it("treats preview input as external smoke data, not deploy proof shell", () => {
    const steps = workflowSteps(loadDeployWorkflow(), "build-and-deploy");
    const smoke = steps.find((step) =>
      step.run?.includes("cloudflare-smoke.js external-url-smoke"),
    );
    const providerSecretNames = [
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

    expect(smoke, "external url smoke step must exist").toBeDefined();
    expect(smoke?.if).toContain("inputs.environment == 'preview'");
    expect(smoke?.run).not.toContain("inputs.preview_url");
    expect(smoke?.run).toContain('--base-url "${PREVIEW_URL}"');
    expect(smoke?.env?.PREVIEW_URL).toBe("${{ inputs.preview_url }}");

    for (const step of steps) {
      expect(step.run ?? "").not.toContain("inputs.preview_url");
      expect(step.run ?? "").not.toMatch(/deployment-url=.*PREVIEW_URL/u);

      if (step.if?.includes("inputs.environment == 'preview'")) {
        for (const secretName of providerSecretNames) {
          expect(step.env?.[secretName], secretName).toBeUndefined();
        }
      }
    }
  });

  it("does not cancel an in-flight production deployment", () => {
    expect(loadDeployWorkflow().concurrency?.["cancel-in-progress"]).toBe(
      "${{ inputs.environment != 'production' }}",
    );
  });

  it("does not allow deploy or verification failures to be ignored", () => {
    const workflow = loadDeployWorkflow();

    for (const job of Object.values(workflow.jobs ?? {})) {
      expect(job["continue-on-error"]).toBeUndefined();
      for (const step of job.steps ?? []) {
        expect(step["continue-on-error"]).toBeUndefined();
      }
    }
  });
});

function workflowSteps(workflow: DeployWorkflow, jobName: string) {
  return workflow.jobs?.[jobName]?.steps ?? [];
}

function findStepIndex(
  steps: readonly { readonly run?: string }[],
  commandFragment: string,
) {
  return steps.findIndex((step) => step.run?.includes(commandFragment));
}
