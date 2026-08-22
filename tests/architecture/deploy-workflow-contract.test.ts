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
  it("guards production deployment to the main branch", () => {
    const workflow = loadDeployWorkflow();
    const guard = workflow.jobs?.["build-and-deploy"]?.steps?.find(
      (step) =>
        step.run?.includes("GITHUB_REF_NAME") && step.run.includes('"main"'),
    );

    expect(guard?.run).toMatch(/GITHUB_REF_NAME[^\n]+!=[^\n]+main/u);
    // 拦截必须真的拦：报错后要 exit 1，否则只是打印警告然后继续部署。
    expect(guard?.run).toContain("exit 1");
    expect(guard?.if).toContain("inputs.environment == 'production'");
  });

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
      "pnpm release:verify 2>&1 | tee cf_build.log",
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

    // 总结的两条证明边界按关键语义逐项断言，不锁整句措辞和步骤名：
    // preview 边界 = preview + SHA + 不证明三个关键语义各自在场；
    // production 边界 = 自动 smoke 对象（workers.dev）与人工确认清单
    // （正式域名、DNS、TLS、custom domain）逐项在场——漏掉任何一项
    // 都等于丢掉一部分发布真实性边界。
    const summaryStep = buildSteps.find((step) =>
      step.run?.includes("GITHUB_STEP_SUMMARY"),
    );
    expect(summaryStep, "deployment summary step must exist").toBeDefined();
    expect(summaryStep?.run).toContain("preview");
    expect(summaryStep?.run).toContain("SHA");
    expect(summaryStep?.run).toContain("不证明");
    expect(summaryStep?.run).toContain("workers.dev");
    for (const boundary of ["正式域名", "DNS", "TLS", "custom domain"]) {
      expect(
        summaryStep?.run,
        `production proof boundary must keep ${boundary}`,
      ).toContain(boundary);
    }
    expect(summaryStep?.run).toContain("由上线负责人确认");
  });

  it("pins the post-deploy smoke Node version before probing", () => {
    const steps = workflowSteps(
      loadDeployWorkflow(),
      "post-deploy-verification",
    );
    const setupNode = steps.findIndex((step) =>
      step.uses?.startsWith("actions/setup-node@"),
    );
    const smoke = steps.findIndex((step) =>
      step.run?.includes("cloudflare-smoke.js deployed-smoke"),
    );

    expect(setupNode).toBeGreaterThanOrEqual(0);
    expect(steps[setupNode]?.with?.["node-version-file"]).toBe(".node-version");
    expect(smoke).toBeGreaterThan(setupNode);
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
    // 定位锚定到真实 node 调用整行：echo/注释里出现同样 token 的假步骤
    // 不能冒充 smoke。预览地址必须在引号内展开（环境变量注入，不是 shell
    // 拼接），引号语义包含在锚定正则里。
    const smoke = steps.find((step) =>
      /^node scripts\/quality\/checks\/cloudflare-smoke\.js external-url-smoke --base-url "\$\{PREVIEW_URL\}"$/mu.test(
        step.run ?? "",
      ),
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
    // 用 id 定位而不是中文步骤名：改标题不该红，步骤职责才是契约。
    const resolver = steps.find((step) => step.id === "resolve_urls");

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
