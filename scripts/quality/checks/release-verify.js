const { spawnSync } = require("node:child_process");
const net = require("node:net");
const {
  RELEASE_PROOF_MANIFEST,
  formatReleaseProofCommand,
  getManualProofLaneSummaryLines,
  getReleaseProofSequence,
  getReleaseVerifyCommands,
} = require("../release-proof-manifest");

const LOCAL_E2E_HOSTS = ["127.0.0.1", "::1"];

const RELEASE_PROOF_SEQUENCE = getReleaseProofSequence();
const RELEASE_VERIFY_COMMANDS = getReleaseVerifyCommands();

function isReleaseVerifyBlockedEnv(name) {
  const value = process.env[name] ?? "";
  return value === "true" || value === "1";
}

function formatReleaseCommand(step) {
  return formatReleaseProofCommand(step);
}

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
  if (isReleaseVerifyBlockedEnv("VALIDATE_CONFIG_SKIP_RUNTIME")) {
    console.error(
      "release-proof must not run with VALIDATE_CONFIG_SKIP_RUNTIME enabled",
    );
    return 1;
  }

  if (isReleaseVerifyBlockedEnv("ALLOW_MEMORY_RATE_LIMIT")) {
    console.error(
      "release-proof must not run with ALLOW_MEMORY_RATE_LIMIT enabled",
    );
    return 1;
  }

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
  for (const line of getManualProofLaneSummaryLines()) {
    console.log(line);
  }
  console.log(
    "  - The Airtable write canary requires deployed Airtable and Turnstile credentials; it does not prove Resend delivery or owner receipt.",
  );
  console.log(
    "Local release proof completed. This is NOT public launch proof.",
  );
  console.log(
    "Public launch still requires strict config, deployed smoke, the Airtable write canary, separate owner receipt, and owner signoff.",
  );
  return 0;
}

module.exports = {
  LOCAL_E2E_HOSTS,
  RELEASE_PROOF_MANIFEST,
  RELEASE_PROOF_SEQUENCE,
  RELEASE_VERIFY_COMMANDS,
  formatReleaseCommand,
  isLocalPortInUse,
  isReleaseVerifyBlockedEnv,
  parseWranglerDryRunGzipKiB,
  runReleaseVerify,
  runReleaseVerifyCommand,
  validateArtifactBudget,
};
