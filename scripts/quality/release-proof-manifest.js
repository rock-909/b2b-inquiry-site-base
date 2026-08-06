const RELEASE_PROOF_LANES = Object.freeze({
  LOCAL_TEST_MODE: "local/test-mode",
  DEPLOYED_SMOKE: "deployed-smoke",
  AIRTABLE_WRITE_CANARY: "airtable-write-canary",
});

const RELEASE_PROOF_MANIFEST = deepFreeze({
  version: 1,
  steps: [
    {
      id: "content-manifest-freshness",
      label: "Generated content manifest freshness",
      lane: RELEASE_PROOF_LANES.LOCAL_TEST_MODE,
      command: "node",
      args: ["scripts/starter-checks.js", "content-manifest", "--check"],
    },
    {
      id: "cloudflare-official-source-compare",
      label: "Cloudflare official source compare",
      lane: RELEASE_PROOF_LANES.LOCAL_TEST_MODE,
      command: "node",
      args: [
        "scripts/starter-checks.js",
        "cf-official-compare",
        "--source-only",
      ],
    },
    {
      id: "type-check",
      label: "TypeScript type check",
      lane: RELEASE_PROOF_LANES.LOCAL_TEST_MODE,
      command: "pnpm",
      args: ["type-check"],
    },
    {
      id: "lint-check",
      label: "ESLint quality check",
      lane: RELEASE_PROOF_LANES.LOCAL_TEST_MODE,
      command: "pnpm",
      args: ["lint:check"],
    },
    {
      id: "focused-release-contract-tests",
      label: "Middleware, i18n, and deploy workflow contracts",
      lane: RELEASE_PROOF_LANES.LOCAL_TEST_MODE,
      command: "pnpm",
      args: [
        "exec",
        "vitest",
        "run",
        "tests/architecture/deploy-workflow-contract.test.ts",
        "tests/unit/middleware.test.ts",
        "src/__tests__/middleware-locale-cookie.test.ts",
        "src/i18n/__tests__/request.test.ts",
        "src/lib/__tests__/load-messages.fallback.test.ts",
      ],
    },
    {
      id: "lead-family-api-tests",
      label: "Lead family API tests",
      lane: RELEASE_PROOF_LANES.LOCAL_TEST_MODE,
      command: "pnpm",
      args: [
        "exec",
        "vitest",
        "run",
        "tests/integration/api/lead-family-contract.test.ts",
        "tests/integration/api/lead-family-protection.test.ts",
        "src/app/api/inquiry/__tests__/route.test.ts",
      ],
    },
    {
      id: "health-api-tests",
      label: "Health API tests",
      lane: RELEASE_PROOF_LANES.LOCAL_TEST_MODE,
      command: "pnpm",
      args: [
        "exec",
        "vitest",
        "run",
        "tests/integration/api/health.test.ts",
        "src/__tests__/middleware-locale-cookie.test.ts",
      ],
    },
    {
      id: "translations",
      label: "Translation packs",
      lane: RELEASE_PROOF_LANES.LOCAL_TEST_MODE,
      command: "node",
      args: ["scripts/starter-checks.js", "translations"],
    },
    {
      id: "content-readiness-catalog",
      label: "Catalog content readiness",
      lane: RELEASE_PROOF_LANES.LOCAL_TEST_MODE,
      command: "node",
      args: ["scripts/starter-checks.js", "content-readiness"],
    },
    {
      id: "local-playwright-smoke",
      label: "Local Playwright E2E smoke",
      lane: RELEASE_PROOF_LANES.LOCAL_TEST_MODE,
      command: "pnpm",
      // 不点名文件：testDir 下的用例全跑。上线前的本地证明没有理由比 PR 门禁窄。
      args: ["exec", "playwright", "test", "--project=chromium"],
      env: {
        CI: "1",
        PLAYWRIGHT_REBUILD_SERVER: "true",
      },
      requiresFreePort: 3000,
    },
    {
      id: "next-build",
      label: "Next.js build",
      lane: RELEASE_PROOF_LANES.LOCAL_TEST_MODE,
      command: "pnpm",
      args: ["build"],
    },
    {
      id: "cloudflare-build",
      label: "Cloudflare build",
      lane: RELEASE_PROOF_LANES.LOCAL_TEST_MODE,
      command: "pnpm",
      args: ["website:build:cf"],
    },
    {
      id: "cloudflare-artifact-config",
      label: "Cloudflare artifact config",
      lane: RELEASE_PROOF_LANES.LOCAL_TEST_MODE,
      command: "node",
      args: ["scripts/quality/checks/cloudflare-artifact-config.js"],
    },
    {
      id: "cloudflare-static-asset-headers",
      label: "Cloudflare Static Assets headers",
      lane: RELEASE_PROOF_LANES.LOCAL_TEST_MODE,
      command: "node",
      args: ["scripts/starter-checks.js", "cf-static-asset-headers"],
    },
    {
      id: "wrangler-preview-dry-run",
      label: "Wrangler preview dry run",
      lane: RELEASE_PROOF_LANES.LOCAL_TEST_MODE,
      command: "pnpm",
      args: ["exec", "wrangler", "deploy", "--dry-run", "--env", "preview"],
      artifactBudget: {
        metric: "gzip KiB",
        limitKiB: 3000,
        preferredKiB: 2700,
        measuredArtifact: "source-checkout",
        source:
          "Project self-budget (3000 KiB), ~72 KiB margin below the Cloudflare Workers Free gzip upload limit of 3072 KiB (3 MiB)",
      },
    },
  ],
  manualProofLanes: [
    {
      lane: RELEASE_PROOF_LANES.LOCAL_TEST_MODE,
      label: "Local stock preview",
      command: "node scripts/starter-checks.js cf-preview-smoke",
    },
    {
      lane: RELEASE_PROOF_LANES.DEPLOYED_SMOKE,
      label: "Real preview publish path",
      command: "node scripts/starter-checks.js cf-preview-deployed",
    },
    {
      lane: RELEASE_PROOF_LANES.DEPLOYED_SMOKE,
      label: "Deployed GET smoke",
      command:
        'node scripts/starter-checks.js deployed-smoke --base-url "$DEPLOYED_BASE_URL"',
    },
    {
      lane: RELEASE_PROOF_LANES.AIRTABLE_WRITE_CANARY,
      label: "Deployed Airtable write canary manual launch gate",
      command:
        'POST_DEPLOY_TEST=1 PLAYWRIGHT_BASE_URL="$DEPLOYED_BASE_URL" pnpm exec playwright test tests/e2e/smoke/',
    },
  ],
});

function deepFreeze(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  for (const propertyValue of Object.values(value)) {
    deepFreeze(propertyValue);
  }

  return Object.freeze(value);
}

function cloneStep(step) {
  return {
    ...step,
    args: [...step.args],
    ...(step.env ? { env: { ...step.env } } : {}),
    ...(step.artifactBudget
      ? { artifactBudget: { ...step.artifactBudget } }
      : {}),
  };
}

function cloneReleaseVerifyCommand(step) {
  return {
    id: step.id,
    command: step.command,
    args: [...step.args],
    ...(step.env ? { env: { ...step.env } } : {}),
    ...(step.requiresFreePort
      ? { requiresFreePort: step.requiresFreePort }
      : {}),
    ...(step.artifactBudget
      ? { artifactBudget: { ...step.artifactBudget } }
      : {}),
  };
}

function formatReleaseProofCommand(step) {
  const envPrefix = step.env
    ? `${Object.entries(step.env)
        .map(([name, value]) => `${name}=${value}`)
        .join(" ")} `
    : "";

  return `${envPrefix}${step.command} ${step.args.join(" ")}`;
}

function getReleaseProofSteps() {
  return RELEASE_PROOF_MANIFEST.steps.map(cloneStep);
}

function getReleaseProofSequence() {
  return getReleaseProofSteps().map(formatReleaseProofCommand);
}

function getReleaseVerifyCommands() {
  return RELEASE_PROOF_MANIFEST.steps.map(cloneReleaseVerifyCommand);
}

function getManualProofLaneSummaryLines() {
  return RELEASE_PROOF_MANIFEST.manualProofLanes.map(
    (entry) => `  - [${entry.lane}] ${entry.label}: ${entry.command}`,
  );
}

module.exports = {
  RELEASE_PROOF_LANES,
  RELEASE_PROOF_MANIFEST,
  formatReleaseProofCommand,
  getManualProofLaneSummaryLines,
  getReleaseProofSequence,
  getReleaseProofSteps,
  getReleaseVerifyCommands,
};
