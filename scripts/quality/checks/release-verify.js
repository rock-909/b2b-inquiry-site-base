const { spawnSync } = require("node:child_process");
const net = require("node:net");

const LOCAL_E2E_HOSTS = ["127.0.0.1", "::1"];
/** @type {Array<{
 * id: string,
 * command: string,
 * args: string[],
 * env?: Record<string, string>,
 * requiresFreePort?: number,
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
  { id: "format-check", command: "pnpm", args: ["format:check"] },
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
  {
    id: "prerender-static",
    command: "node",
    args: ["scripts/quality/checks/prerender-static.js"],
  },
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
    id: "wrangler-dry-run",
    command: "pnpm",
    args: ["exec", "wrangler", "deploy", "--dry-run", "--env", "preview"],
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
    stdio: "inherit",
    timeout: 15 * 60 * 1000,
    killSignal: "SIGKILL",
    env: {
      ...process.env,
      ...(step.env ?? {}),
    },
  });

  return result.status ?? 1;
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
 *   environment?: string,
 *   runCommand?: (
 *     step: (typeof RELEASE_VERIFY_COMMANDS)[number],
 *     rootDir: string,
 *   ) => number,
 *   portInUse?: (port?: number, hosts?: string[]) => Promise<boolean>,
 * }=} options
 */
async function runReleaseVerify({
  rootDir = process.cwd(),
  environment = "preview",
  runCommand = runReleaseVerifyCommand,
  portInUse = isLocalPortInUse,
} = {}) {
  if (!["preview", "production"].includes(environment))
    throw new Error("Unsupported release environment");
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

    const command =
      step.id === "wrangler-dry-run"
        ? { ...step, args: [...step.args.slice(0, -1), environment] }
        : step;
    const status = runCommand(command, rootDir);
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
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--env"))
    throw new Error("Usage: release-verify.js [--env preview|production]");
  runReleaseVerify({ environment: args[1] ?? "preview" }).then(
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
  runReleaseVerify,
  runReleaseVerifyCommand,
};
