const { spawnSync } = require("node:child_process");
const net = require("node:net");

const LOCAL_E2E_HOSTS = ["127.0.0.1", "::1"];
/** @type {Array<{
 * id: string,
 * command: string,
 * args: string[],
 * env?: Record<string, string>,
 * requiresFreePort?: number,
 * artifactBudget?: {
 *   metric: string,
 *   limitKiB: number,
 *   preferredKiB: number,
 *   measuredArtifact: string,
 *   source: string,
 * },
 * }>} */
const RELEASE_VERIFY_COMMANDS = [
  {
    id: "cloudflare-config-check",
    command: "node",
    args: ["scripts/quality/checks/cloudflare-config-check.js"],
  },
  { id: "type-check", command: "pnpm", args: ["type-check"] },
  { id: "test-type-check", command: "pnpm", args: ["type-check:tests"] },
  { id: "lint-check", command: "pnpm", args: ["lint:check"] },
  { id: "tests", command: "pnpm", args: ["test"] },
  {
    id: "translations",
    command: "node",
    args: ["scripts/quality/checks/translations.js"],
  },
  {
    id: "local-playwright-smoke",
    command: "pnpm",
    args: ["exec", "playwright", "test", "--project=chromium"],
    env: { CI: "1", PLAYWRIGHT_REBUILD_SERVER: "true" },
    requiresFreePort: 3000,
  },
  { id: "next-build", command: "pnpm", args: ["build"] },
  { id: "cloudflare-build", command: "pnpm", args: ["website:build:cf"] },
  {
    id: "cloudflare-artifact-config",
    command: "node",
    args: ["scripts/quality/checks/cloudflare-artifact-config.js"],
  },
  {
    id: "cloudflare-static-asset-headers",
    command: "node",
    args: ["scripts/quality/checks/cloudflare-static-asset-headers.js"],
  },
  {
    id: "wrangler-preview-dry-run",
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
];

const MANUAL_PROOF_LANES = [
  {
    lane: "local/test-mode",
    label: "Local stock preview",
    command: "node scripts/quality/checks/cloudflare-smoke.js cf-preview-smoke",
  },
  {
    lane: "deployed-smoke",
    label: "Real preview publish path",
    command:
      "node scripts/quality/checks/cloudflare-smoke.js cf-preview-deployed",
  },
  {
    lane: "deployed-smoke",
    label: "Deployed GET smoke",
    command:
      'node scripts/quality/checks/cloudflare-smoke.js deployed-smoke --base-url "$DEPLOYED_BASE_URL"',
  },
  {
    lane: "airtable-write-canary",
    label: "Deployed Airtable write canary manual launch gate",
    command: 'PLAYWRIGHT_BASE_URL="$DEPLOYED_BASE_URL" pnpm canary:airtable',
  },
];

function runReleaseVerifyCommand(step, rootDir) {
  const result = spawnSync(step.command, step.args, {
    cwd: rootDir,
    stdio: step.artifactBudget ? "pipe" : "inherit",
    encoding: step.artifactBudget ? "utf8" : undefined,
    env: {
      ...process.env,
      ...(step.env ?? {}),
    },
  });

  if (step.artifactBudget) {
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");

    const status = result.status ?? 1;
    if (status !== 0) return status;

    return validateArtifactBudget(step.artifactBudget, output);
  }

  return result.status ?? 1;
}

function parseWranglerDryRunGzipKiB(output) {
  const match = output.match(/gzip:\s*(\d+(?:\.\d+)?)\s*KiB/iu);
  if (!match?.[1]) return null;

  return Number.parseFloat(match[1]);
}

function validateArtifactBudget(artifactBudget, output) {
  const measuredKiB = parseWranglerDryRunGzipKiB(output);

  if (measuredKiB === null) {
    console.error(
      "Cloudflare artifact budget check failed: missing gzip size.",
    );
    return 1;
  }

  if (measuredKiB > artifactBudget.limitKiB) {
    console.error(
      `Cloudflare artifact budget exceeded: ${measuredKiB.toFixed(2)} KiB gzip > ${artifactBudget.limitKiB} KiB.`,
    );
    return 1;
  }

  if (measuredKiB > artifactBudget.preferredKiB) {
    console.warn(
      `Cloudflare artifact budget warning: ${measuredKiB.toFixed(2)} KiB gzip is above preferred ${artifactBudget.preferredKiB} KiB headroom.`,
    );
  }

  return 0;
}

async function isLocalPortInUse(port, hosts = LOCAL_E2E_HOSTS) {
  const results = await Promise.all(
    hosts.map(
      (host) =>
        new Promise((resolve) => {
          const socket = net.createConnection({ host, port });

          socket.setTimeout(1000);
          socket.once("connect", () => {
            socket.destroy();
            resolve(true);
          });
          socket.once("timeout", () => {
            socket.destroy();
            resolve(false);
          });
          socket.once("error", () => {
            socket.destroy();
            resolve(false);
          });
        }),
    ),
  );

  return results.some(Boolean);
}

/**
 * @param {{
 *   rootDir?: string,
 *   runCommand?: (
 *     step: (typeof RELEASE_VERIFY_COMMANDS)[number],
 *     rootDir: string,
 *   ) => number | {status?: number, stdout?: string, stderr?: string},
 *   portInUse?: (port?: number, hosts?: string[]) => Promise<boolean>,
 * }=} options
 */
async function runReleaseVerify({
  rootDir = process.cwd(),
  runCommand = runReleaseVerifyCommand,
  portInUse = isLocalPortInUse,
} = {}) {
  console.log("== Release verification flow ==");
  for (const step of RELEASE_VERIFY_COMMANDS) {
    if (step.requiresFreePort) {
      const blocked = await portInUse(step.requiresFreePort);
      if (blocked) {
        console.error(
          `release-proof cannot start ${step.id} because localhost:${step.requiresFreePort} is already in use.`,
        );
        console.error(
          "Stop the existing local server and rerun pnpm release:verify.",
        );
        return 1;
      }
    }

    const result = runCommand(step, rootDir);
    const status =
      typeof result === "number"
        ? result
        : (result.status ?? 1) === 0 && step.artifactBudget
          ? validateArtifactBudget(
              step.artifactBudget,
              `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
            )
          : (result.status ?? 1);
    if (status !== 0) return status;
  }

  console.log("Cloudflare proof split:");
  for (const entry of MANUAL_PROOF_LANES) {
    console.log(`  - [${entry.lane}] ${entry.label}: ${entry.command}`);
  }
  console.log(
    "  - The Airtable write canary requires a deployed Turnstile flow and Airtable credentials; it does not prove Resend delivery or owner receipt.",
  );
  console.log(
    "Local release proof completed. This is NOT public launch proof.",
  );
  console.log(
    "Still separate: deployment and Worker URL smoke; Airtable canary; Resend provider status and owner inbox receipt; production domain, DNS, TLS, legal, contact, and owner approval.",
  );
  return 0;
}

if (require.main === module) {
  runReleaseVerify().then(
    (status) => {
      process.exitCode = status;
    },
    (error) => {
      console.error("[release-verify] Unexpected error:", error);
      process.exitCode = 1;
    },
  );
}

module.exports = {
  LOCAL_E2E_HOSTS,
  MANUAL_PROOF_LANES,
  RELEASE_VERIFY_COMMANDS,
  isLocalPortInUse,
  parseWranglerDryRunGzipKiB,
  runReleaseVerify,
  runReleaseVerifyCommand,
  validateArtifactBudget,
};
