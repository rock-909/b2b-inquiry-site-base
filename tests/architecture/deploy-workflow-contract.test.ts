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
  it("guards production deployment to the main branch", () => {
    const workflow = loadDeployWorkflow();
    const guard = workflow.jobs?.["build-and-deploy"]?.steps?.find(
      (step) =>
        step.run?.includes("GITHUB_REF_NAME") && step.run.includes('"main"'),
    );

    expect(guard?.run).toMatch(/GITHUB_REF_NAME[^\n]+!=[^\n]+main/u);
    expect(guard?.if).toContain("inputs.environment == 'production'");
  });

  it("runs strict production gates before deployment", () => {
    const steps = workflowSteps(loadDeployWorkflow(), "build-and-deploy");
    const configGate = findStepIndex(steps, "validate-production-config");
    const contentGate = findStepIndex(
      steps,
      "content-readiness --strict-client-launch",
    );
    const deploy = steps.findIndex((step) => step.id === "deploy_production");
    const deployStep = steps[deploy];

    expect(configGate).toBeGreaterThanOrEqual(0);
    expect(contentGate).toBeGreaterThan(configGate);
    expect(deploy).toBeGreaterThan(contentGate);
    expect(deployStep?.if).toContain("inputs.environment == 'production'");
    expect(deployStep?.run).toContain(
      "pnpm exec opennextjs-cloudflare deploy --env production",
    );
    expect(deployStep?.run).not.toContain("--env preview");
  });

  it("keeps post-deploy verification serialized after the deploy job", () => {
    const workflow = loadDeployWorkflow();
    const smokeStep = workflowSteps(workflow, "post-deploy-verification").find(
      (step) => step.run?.includes("starter-checks.js deployed-smoke"),
    );

    expect(
      normalizeNeeds(workflow.jobs?.["post-deploy-verification"]?.needs),
    ).toContain("build-and-deploy");
    expect(smokeStep?.run).toContain(
      "needs.build-and-deploy.outputs.deployment_url",
    );
  });

  it("keeps preview smoke free of production-only dependency installation", () => {
    const workflow = loadDeployWorkflow();
    const buildSteps = workflowSteps(workflow, "build-and-deploy");
    const dependencyInstalls = buildSteps.filter((step) =>
      step.run?.includes("pnpm install --frozen-lockfile"),
    );
    const browserInstalls = buildSteps.filter((step) =>
      step.run?.includes("playwright install"),
    );
    const postDeploySteps = workflowSteps(workflow, "post-deploy-verification");

    expect(dependencyInstalls.length).toBeGreaterThan(0);
    expect(browserInstalls.length).toBeGreaterThan(0);
    for (const step of [...dependencyInstalls, ...browserInstalls]) {
      expect(step.if).toContain("inputs.environment == 'production'");
    }
    expect(
      postDeploySteps.some((step) => step.run?.includes("pnpm install")),
    ).toBe(false);
  });

  it("treats preview input as external smoke data, not deploy proof shell", () => {
    const steps = workflowSteps(loadDeployWorkflow(), "build-and-deploy");
    const smoke = steps.find((step) =>
      step.run?.includes("external-url-smoke"),
    );
    const providerSecretNames = [
      "RATE_LIMIT_PEPPER",
      "TURNSTILE_SECRET_KEY",
      "RESEND_API_KEY",
      "AIRTABLE_API_KEY",
      "AIRTABLE_BASE_ID",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
    ];

    expect(smoke?.name).toBe("外部 URL smoke（preview 输入）");
    expect(smoke?.if).toContain("inputs.environment == 'preview'");
    expect(smoke?.run).toContain(
      'node scripts/starter-checks.js external-url-smoke --base-url "${PREVIEW_URL}"',
    );
    expect(smoke?.run).not.toContain("inputs.preview_url");
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

  it("does not export a deployment URL for preview-only external smoke", () => {
    const steps = workflowSteps(loadDeployWorkflow(), "build-and-deploy");
    const resolver = steps.find((step) => step.name === "汇总 URL");

    expect(resolver?.run).not.toContain("deployment-url=${PREVIEW_URL}");
    expect(resolver?.run).not.toContain("external-smoke-url=${PREVIEW_URL}");
    expect(resolver?.run).not.toContain("inputs.preview_url");
    expect(resolver?.env?.PREVIEW_URL).toBe("${{ inputs.preview_url }}");
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
