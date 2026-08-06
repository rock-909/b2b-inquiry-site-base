import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { load } from "js-yaml";

interface WorkflowStep {
  readonly name?: string;
  readonly uses?: string;
  readonly run?: string;
  readonly env?: Record<string, string>;
  readonly with?: Record<string, unknown>;
}

interface WorkflowJob {
  readonly steps?: WorkflowStep[];
}

interface Workflow {
  readonly jobs?: Record<string, WorkflowJob>;
}

function readCiWorkflow(): Workflow {
  return load(readFileSync(".github/workflows/ci.yml", "utf8")) as Workflow;
}

function expectPreviewStepEnv(
  step: WorkflowStep | undefined,
  stepName: string,
): void {
  const previewSiteUrl =
    "${{ vars.CLOUDFLARE_PREVIEW_URL || 'https://tucsenberg-site-preview.faints-pudgier-9r.workers.dev' }}";
  const gaMeasurementId =
    "${{ vars.NEXT_PUBLIC_GA_MEASUREMENT_ID || secrets.NEXT_PUBLIC_GA_MEASUREMENT_ID }}";
  const googleSiteVerification =
    "${{ vars.GOOGLE_SITE_VERIFICATION || secrets.GOOGLE_SITE_VERIFICATION }}";
  const turnstileSiteKey =
    "${{ vars.NEXT_PUBLIC_TURNSTILE_SITE_KEY || secrets.NEXT_PUBLIC_TURNSTILE_SITE_KEY }}";

  expect(step?.env?.APP_ENV, stepName).toBe("preview");
  expect(step?.env?.NEXT_PUBLIC_SITE_URL, stepName).toBe(previewSiteUrl);
  expect(step?.env?.NEXT_PUBLIC_GA_MEASUREMENT_ID, stepName).toBe(
    gaMeasurementId,
  );
  expect(step?.env?.GOOGLE_SITE_VERIFICATION, stepName).toBe(
    googleSiteVerification,
  );
  expect(step?.env?.NEXT_PUBLIC_TURNSTILE_SITE_KEY, stepName).toBe(
    turnstileSiteKey,
  );
  expect(step?.env?.NEXT_PUBLIC_SITE_URL, stepName).not.toContain(
    "example.com",
  );
  expect(step?.env?.NEXT_PUBLIC_SITE_URL, stepName).not.toContain(
    "tucsenberg.com",
  );
}

describe("CI preview environment contract", () => {
  // 原来这条只点名了一个 spec 文件。点名式断言只能证明那一个在跑，反而让另外
  // 几个文件哪个 workflow 都没跑还一路绿灯。改成守"这一步不按文件过滤"。
  it("runs the whole browser lane on PRs instead of a named subset", () => {
    const workflow = readCiWorkflow();
    const browserSteps = workflow.jobs?.e2e?.steps;
    const testStep = browserSteps?.find(
      (candidate) => candidate.name === "运行 Tucsenberg E2E",
    );

    expect(testStep?.run?.trim()).toBe("pnpm exec playwright test");
  });

  it("keeps the client-boundary proof immediately after the isolated analysis build", () => {
    const workflow = readCiWorkflow();
    const cloudflareBuildSteps =
      workflow.jobs?.["cloudflare-build"]?.steps ?? [];
    const analysisStepIndex = cloudflareBuildSteps.findIndex(
      (candidate) => candidate.run === "pnpm build",
    );
    const clientBoundaryStepIndex = cloudflareBuildSteps.findIndex(
      (candidate) =>
        candidate.run ===
        "node scripts/starter-checks.js client-boundary --build-artifacts",
    );
    const cloudflareBuildStepIndex = cloudflareBuildSteps.findIndex(
      (candidate) => candidate.name === "Cloudflare/OpenNext 构建",
    );
    const analysisStep = cloudflareBuildSteps[analysisStepIndex];

    expect(analysisStep?.name).toContain("分析构建");
    expect(analysisStep?.env?.DEPLOYMENT_PLATFORM).toBeUndefined();
    expect(clientBoundaryStepIndex).toBe(analysisStepIndex + 1);
    expect(clientBoundaryStepIndex).toBeLessThan(cloudflareBuildStepIndex);
  });

  it("runs canonical Cloudflare build proof against a public preview URL", () => {
    const workflow = readCiWorkflow();
    const cloudflareBuildSteps = workflow.jobs?.["cloudflare-build"]?.steps;

    for (const stepName of [
      "Cloudflare/OpenNext 构建",
      "Cloudflare/Wrangler dry-run",
    ]) {
      const step = cloudflareBuildSteps?.find(
        (candidate) => candidate.name === stepName,
      );

      expectPreviewStepEnv(step, stepName);
      expect(step?.env).toMatchObject({
        DEPLOYMENT_PLATFORM: "cloudflare",
        NEXT_PUBLIC_DEPLOYMENT_PLATFORM: "cloudflare",
      });
    }
  });

  it("proves the generated Next and OpenNext artifact configuration", () => {
    const workflow = readCiWorkflow();
    const cloudflareBuildSteps =
      workflow.jobs?.["cloudflare-build"]?.steps ?? [];
    const cloudflareBuildStepIndex = cloudflareBuildSteps.findIndex(
      (candidate) => candidate.name === "Cloudflare/OpenNext 构建",
    );
    const artifactProofStepIndex = cloudflareBuildSteps.findIndex(
      (candidate) => candidate.name === "验证 Cloudflare artifact config",
    );
    const artifactProof = cloudflareBuildSteps[artifactProofStepIndex]?.run;

    expect(artifactProofStepIndex).toBe(cloudflareBuildStepIndex + 1);
    expect(artifactProof).toBe(
      "node scripts/quality/checks/cloudflare-artifact-config.js",
    );
  });
});
