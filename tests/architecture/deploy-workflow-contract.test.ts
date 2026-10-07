/* eslint-disable security/detect-non-literal-fs-filename -- 路径都位于本测试创建的临时 fixture 下 */
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { data, Evaluator, Lexer, Parser } from "@actions/expressions";
import { load } from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";

interface DeployWorkflow {
  readonly concurrency?: {
    readonly "cancel-in-progress"?: boolean | string;
  };
  readonly jobs?: Record<
    string,
    {
      readonly environment?: string;
      readonly outputs?: Record<string, string>;
      readonly needs?: string | readonly string[];
      readonly "continue-on-error"?: boolean;
      readonly steps?: readonly {
        readonly id?: string;
        readonly if?: string;
        readonly name?: string;
        readonly run?: string;
        readonly uses?: string;
        readonly with?: Record<string, string | boolean>;
        readonly env?: Record<string, string>;
        readonly "continue-on-error"?: boolean;
      }[];
    }
  >;
}

const DEPLOYMENT_URL_EXPRESSION =
  "${{ needs.build-and-deploy.outputs.deployment_url }}";
const FIXTURE_PREFIX = "deploy-workflow-contract-";
const tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// 替身 curl/node 只记录收到的参数；curl 恒返回 200，让就绪探测一次通过。
function createDeployFixture() {
  const rootDir = mkdtempSync(path.join(process.cwd(), FIXTURE_PREFIX));
  tempDirs.push(rootDir);
  const binDir = path.join(rootDir, "bin");
  mkdirSync(binDir);
  const argLog = path.join(rootDir, "args.log");
  const githubOutput = path.join(rootDir, "github-output");
  writeFileSync(githubOutput, "");
  const recorder = (output: string) =>
    [
      "#!/bin/sh",
      'for arg in "$@"; do printf "%s\\n" "$arg" >> "$ARG_LOG"; done',
      output,
      "",
    ].join("\n");
  for (const [name, body] of [
    ["curl", recorder('printf "200"')],
    ["node", recorder("exit 0")],
    ["pnpm", recorder('printf "%s\\n" "$DEPLOYMENT_URL"')],
  ] as const) {
    writeFileSync(path.join(binDir, name), body);
    chmodSync(path.join(binDir, name), 0o755);
  }
  mkdirSync(path.join(rootDir, "scripts/quality/checks"), { recursive: true });
  writeFileSync(
    path.join(rootDir, "scripts/quality/checks/cloudflare-smoke.js"),
    "",
  );

  return {
    run: (
      script: string,
      deploymentUrl: string,
      env: Record<string, string> = {},
    ) =>
      spawnSync("bash", ["-e", "-c", script], {
        cwd: rootDir,
        encoding: "utf8",
        env: {
          PATH: `${binDir}:/usr/bin:/bin`,
          ARG_LOG: argLog,
          DEPLOYMENT_URL: deploymentUrl,
          NODE_ENV: "test",
          GITHUB_OUTPUT: githubOutput,
          ...env,
        },
      }),
    output: () => readFileSync(githubOutput, "utf8"),
    recordedArguments: () =>
      existsSync(argLog) ? readFileSync(argLog, "utf8").split("\n") : [],
    exists: (name: string) => existsSync(path.join(rootDir, name)),
  };
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
    const verificationSteps = workflowSteps(
      workflow,
      "post-deploy-verification",
    );

    expect(
      normalizeNeeds(workflow.jobs?.["post-deploy-verification"]?.needs),
    ).toContain("build-and-deploy");
    expect(
      verificationSteps.filter(
        (step) => step.env?.DEPLOYMENT_URL === DEPLOYMENT_URL_EXPRESSION,
      ),
    ).toHaveLength(2);
    expect(workflow.jobs?.["build-and-deploy"]?.outputs?.deployment_url).toBe(
      "${{ steps.resolve_urls.outputs.deployment-url }}",
    );
  });

  it.each([
    "https://fixture.workers.dev",
    'https://$(touch${IFS}pwned-sub)`touch${IFS}pwned-bt`"quote.workers.dev',
  ])("emits the deployed URL through both output handoffs: %s", (url) => {
    const steps = workflowSteps(loadDeployWorkflow(), "build-and-deploy");
    const deploy = steps.find((step) => step.id === "deploy_production");
    const resolve = steps.find((step) => step.id === "resolve_urls");

    expect(resolve?.env?.WORKER_URL).toBe(
      "${{ steps.deploy_production.outputs.worker-url }}",
    );
    expect(resolve?.env?.DEPLOY_ENVIRONMENT).toBe("${{ inputs.environment }}");
    assertDeploymentOutput(deploy?.run ?? "", resolve?.run ?? "", url);
  });

  it.each(["deploy", "resolve"])(
    "rejects a missing %s output even when the shell succeeds",
    (stage) => {
      const steps = workflowSteps(loadDeployWorkflow(), "build-and-deploy");
      const deploy = steps.find((step) => step.id === "deploy_production");
      const resolve = steps.find((step) => step.id === "resolve_urls");

      expect(() =>
        assertDeploymentOutput(
          stage === "deploy" ? ":" : (deploy?.run ?? ""),
          stage === "resolve" ? ":" : (resolve?.run ?? ""),
          "https://fixture.workers.dev",
        ),
      ).toThrow(/expected/u);
    },
  );

  // 部署 URL 来自 wrangler 输出，被篡改的值必须始终只是数据：这里用替身
  // curl/node 真实执行 post-deploy 的两个 shell 步骤，核对收到的参数，
  // 并用带 shell 元字符的 URL 证明它不会被当作命令执行。
  it("passes the deployed URL to post-deploy steps as data, never as shell", () => {
    const steps = workflowSteps(
      loadDeployWorkflow(),
      "post-deploy-verification",
    );
    const urlSteps = steps.filter(
      (step) => step.env?.DEPLOYMENT_URL === DEPLOYMENT_URL_EXPRESSION,
    );
    expect(urlSteps).toHaveLength(2);

    const hostileUrl =
      'https://x.workers.dev/$(touch pwned-sub)`touch pwned-bt`"; touch pwned-q';
    for (const step of urlSteps) {
      const fixture = createDeployFixture();
      const result = fixture.run(step.run ?? "", hostileUrl);

      expect(result.status, `${step.name}: ${result.stderr}`).toBe(0);
      expect(fixture.recordedArguments(), step.name).toContain(hostileUrl);
      for (const marker of ["pwned-sub", "pwned-bt", "pwned-q"]) {
        expect(fixture.exists(marker), `${step.name} ran ${marker}`).toBe(
          false,
        );
      }
    }
  });

  it("does not persist checkout credentials in any deploy workflow job", () => {
    const checkouts = Object.values(loadDeployWorkflow().jobs ?? {})
      .flatMap((job) => job?.steps ?? [])
      .filter((step) => step.uses?.startsWith("actions/checkout@"));

    expect(checkouts.length).toBeGreaterThan(0);
    for (const step of checkouts) {
      expect(step.with?.["persist-credentials"], step.name).toBe(false);
    }
  });

  it("pins third-party actions that run beside deploy secrets to commit SHAs", () => {
    const uses = Object.values(loadDeployWorkflow().jobs ?? {})
      .flatMap((job) => job?.steps ?? [])
      .map((step) => step.uses ?? "");

    for (const action of ["pnpm/action-setup", "actions/github-script"]) {
      const references = uses.filter((value) => value.startsWith(`${action}@`));
      expect(references.length, action).toBeGreaterThan(0);
      for (const reference of references) {
        expect(reference, action).toMatch(/@[0-9a-f]{40}$/u);
      }
    }
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

  it("runs production release proof without live provider or rate-limit secrets", () => {
    const steps = workflowSteps(loadDeployWorkflow(), "build-and-deploy");
    const proof = steps.find((step) =>
      step.run?.includes("pnpm release:verify --env production"),
    );

    expect(proof, "production release proof step must exist").toBeDefined();
    for (const [name, value] of Object.entries(proof?.env ?? {})) {
      expect(String(value), name).not.toMatch(
        /secrets\.(?!NEXT_PUBLIC_|GOOGLE_SITE_)/u,
      );
    }
  });

  it("selects production only for production dispatch input", () => {
    assertEnvironmentSelection(
      loadDeployWorkflow().jobs?.["build-and-deploy"]?.environment,
    );
  });

  it("accepts equivalent environment-selection expressions", () => {
    assertEnvironmentSelection(
      "${{ (inputs.environment == 'production') && 'production' || '' }}",
    );
  });

  it.each([
    "${{ '' }}",
    "${{ 'production' }}",
    "${{ inputs.environment == 'preview' && 'production' || '' }}",
  ])("rejects incorrect environment selection: %s", (expression) => {
    expect(() => assertEnvironmentSelection(expression)).toThrow(
      /environment for (production|preview)/u,
    );
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

function assertEnvironmentSelection(expression: string | undefined) {
  if (typeof expression !== "string") {
    throw new Error("Deploy job must declare an environment selection");
  }
  const source = /^\$\{\{([\s\S]*)\}\}$/u.exec(expression.trim())?.[1];
  if (source === undefined) {
    throw new Error("Expected an environment-selection expression");
  }
  const { tokens } = new Lexer(source).lex();
  const parsed = new Parser(tokens, ["inputs"], []).parse();

  for (const [input, expected] of [
    ["production", "production"],
    ["preview", ""],
  ] as const) {
    const context = new data.Dictionary({
      key: "inputs",
      value: new data.Dictionary({
        key: "environment",
        value: new data.StringData(input),
      }),
    });
    const selected = new Evaluator(parsed, context).evaluate();
    expect(selected, `environment for ${input}`).toEqual(
      new data.StringData(expected),
    );
  }
}

function assertDeploymentOutput(
  deployScript: string,
  resolveScript: string,
  url: string,
) {
  const deployment = createDeployFixture();
  const deployed = deployment.run(deployScript, url);
  expect(deployed.status, deployed.stderr).toBe(0);
  expect(deployment.output()).toBe(`worker-url=${url}\n`);

  const resolution = createDeployFixture();
  const resolved = resolution.run(resolveScript, url, {
    DEPLOY_ENVIRONMENT: "production",
    WORKER_URL: deployment.output().trimEnd().slice("worker-url=".length),
  });
  expect(resolved.status, resolved.stderr).toBe(0);
  expect(resolution.output()).toBe(`deployment-url=${url}\n`);
  for (const fixture of [deployment, resolution]) {
    for (const marker of ["pwned-sub", "pwned-bt"]) {
      expect(fixture.exists(marker)).toBe(false);
    }
  }
}
