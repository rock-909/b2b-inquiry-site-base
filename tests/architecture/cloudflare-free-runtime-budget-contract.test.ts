import { describe, expect, it } from "vitest";
import { RELEASE_VERIFY_COMMANDS } from "../../scripts/quality/checks/release-verify.js";

// release-verify 执行体积比较；这里只守平台上限和测量顺序。

const CLOUDFLARE_FREE_GZIP_CEILING_KIB = 3072; // 3 MiB，平台硬上限

describe("Cloudflare Free runtime budget contract", () => {
  // 自定预算必须严格低于平台上限。
  it("keeps the self-imposed budget under the platform ceiling", () => {
    const budget = RELEASE_VERIFY_COMMANDS.find(
      (step) => step.id === "wrangler-preview-dry-run",
    )?.artifactBudget;

    expect(budget).toBeDefined();
    expect(budget!.limitKiB).toBeLessThan(CLOUDFLARE_FREE_GZIP_CEILING_KIB);
    expect(budget!.preferredKiB).toBeLessThan(budget!.limitKiB);
  });

  // 必须先重建并检查产物，再用 dry-run 测量当前产物。
  it("measures the artifact only after it has been rebuilt", () => {
    const indexOf = (id: string): number =>
      RELEASE_VERIFY_COMMANDS.findIndex((step) => step.id === id);

    const playwright = indexOf("local-playwright-smoke");
    const nextBuild = indexOf("next-build");
    const build = indexOf("cloudflare-build");
    const artifactConfig = indexOf("cloudflare-artifact-config");
    const headers = indexOf("cloudflare-static-asset-headers");
    const dryRun = indexOf("wrangler-preview-dry-run");

    expect(playwright).toBeGreaterThan(-1);
    expect(nextBuild).toBeGreaterThan(playwright);
    expect(build).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(nextBuild);
    expect(artifactConfig).toBeGreaterThan(build);
    expect(headers).toBeGreaterThan(artifactConfig);
    expect(dryRun).toBeGreaterThan(headers);
  });
});
