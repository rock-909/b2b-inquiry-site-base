import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { load } from "js-yaml";

interface WorkflowStep {
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
    "${{ vars.CLOUDFLARE_PREVIEW_URL || 'https://reference-site-preview.faints-pudgier-9r.workers.dev' }}";
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
    "reference-site.com",
  );
}

describe("CI preview environment contract", () => {
  it("runs the whole browser lane on PRs instead of a named subset", () => {
    const workflow = readCiWorkflow();
    const browserSteps = workflow.jobs?.e2e?.steps;
    const testStep = browserSteps?.find(
      (candidate) => candidate.run === "pnpm exec playwright test",
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
        "node scripts/quality/checks/client-boundary.js --build-artifacts",
    );
    const cloudflareBuildStepIndex = cloudflareBuildSteps.findIndex(
      (candidate) => candidate.run === "pnpm website:build:cf",
    );
    const analysisStep = cloudflareBuildSteps[analysisStepIndex];

    expect(analysisStep?.env?.DEPLOYMENT_PLATFORM).toBeUndefined();
    expect(clientBoundaryStepIndex).toBe(analysisStepIndex + 1);
    expect(clientBoundaryStepIndex).toBeLessThan(cloudflareBuildStepIndex);
  });

  it("runs canonical Cloudflare build proof against a public preview URL", () => {
    const workflow = readCiWorkflow();
    const cloudflareBuildSteps = workflow.jobs?.["cloudflare-build"]?.steps;

    for (const [label, command] of [
      ["OpenNext build", "pnpm website:build:cf"],
      ["Wrangler dry-run", "pnpm exec wrangler deploy --dry-run --env preview"],
    ] as const) {
      const step = cloudflareBuildSteps?.find(
        (candidate) => candidate.run === command,
      );

      expectPreviewStepEnv(step, label);
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
      (candidate) => candidate.run === "pnpm website:build:cf",
    );
    const artifactProofStepIndex = cloudflareBuildSteps.findIndex(
      (candidate) =>
        candidate.run ===
        "node scripts/quality/checks/cloudflare-artifact-config.js",
    );
    const artifactProof = cloudflareBuildSteps[artifactProofStepIndex]?.run;

    expect(artifactProofStepIndex).toBe(cloudflareBuildStepIndex + 1);
    expect(artifactProof).toBe(
      "node scripts/quality/checks/cloudflare-artifact-config.js",
    );
  });
});
