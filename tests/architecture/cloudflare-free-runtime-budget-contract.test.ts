import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// release-verify 执行体积比较；这里只守平台上限和测量顺序。

const CLOUDFLARE_FREE_GZIP_CEILING_KIB = 3072; // 3 MiB，平台硬上限

const requireModule = createRequire(`${process.cwd()}/package.json`);

interface ReleaseProofStep {
  readonly id: string;
  readonly artifactBudget?: {
    readonly limitKiB: number;
    readonly preferredKiB: number;
  };
}

interface ReleaseProofManifestModule {
  readonly getReleaseProofSteps: () => ReleaseProofStep[];
}

function loadReleaseProofSteps(): ReleaseProofStep[] {
  return (
    requireModule(
      "./scripts/quality/release-proof-manifest.js",
    ) as ReleaseProofManifestModule
  ).getReleaseProofSteps();
}

describe("Cloudflare Free runtime budget contract", () => {
  // 自定预算必须严格低于平台上限。
  it("keeps the self-imposed budget under the platform ceiling", () => {
    const budget = loadReleaseProofSteps().find(
      (step) => step.id === "wrangler-preview-dry-run",
    )?.artifactBudget;

    expect(budget).toBeDefined();
    expect(budget!.limitKiB).toBeLessThan(CLOUDFLARE_FREE_GZIP_CEILING_KIB);
    expect(budget!.preferredKiB).toBeLessThan(budget!.limitKiB);
  });

  // 必须先重建并检查产物，再用 dry-run 测量当前产物。
  it("measures the artifact only after it has been rebuilt", () => {
    const steps = loadReleaseProofSteps();
    const indexOf = (id: string): number =>
      steps.findIndex((step) => step.id === id);

    const build = indexOf("cloudflare-build");
    const headers = indexOf("cloudflare-static-asset-headers");
    const dryRun = indexOf("wrangler-preview-dry-run");

    expect(build).toBeGreaterThan(-1);
    expect(headers).toBeGreaterThan(build);
    expect(dryRun).toBeGreaterThan(headers);
  });
});
