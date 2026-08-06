#!/usr/bin/env node

const ROOT = process.cwd();

function printUsage() {
  console.error(`Usage: node scripts/starter-checks.js <command> [options]

Commands:
  vitest-collection   Check vitest runs every test file on disk
  subcommand-lanes    Check every subcommand here is wired into a lane
  content-slugs       Check localized MDX slug pairs
  content-manifest    Generate content manifest only (--check verifies freshness)
  translations        Check catalog message pack and compat translation shapes
  message-key-usage   Check message catalog leaves against real consumers
  validate-production-config Validate production and public-launch config gates
  component-governance Check component registry, Storybook, and UI wrapper drift
  content-readiness   Check buyer-visible catalog residue (--strict-client-launch promotes launch blockers to errors)
  client-boundary     Check top-level use client budget (--build-artifacts after pnpm build)
  prerender-static    Check localized Next.js build output stays prerendered
  cf-preview-smoke    Probe local Cloudflare preview behavior
  external-url-smoke Probe an externally supplied URL surface; does not prove current SHA deployment
  deployed-smoke      Probe deployed URL route health
  cf-preview-deployed Deploy preview workers and run deployed smoke
  cf-official-compare Check Cloudflare source/generated deploy config contract
  cf-static-asset-headers Check Cloudflare Static Assets _headers artifact
  release-verify      Run full release verification flow
`);
}

// Module scope so callers can ask which commands exist. Tests that want to
// prove a package script is wired to a real check need the command list, not a
// frozen copy of the command string.
const COMMAND_HANDLERS = {
  "vitest-collection": () =>
    require("./quality/checks/vitest-collection").runVitestCollectionCheck(),
  "subcommand-lanes": () =>
    require("./quality/checks/subcommand-lanes").runSubcommandLaneCheck(
      STARTER_CHECK_COMMANDS,
    ),
  "content-slugs": (args) =>
    require("./quality/checks/content-slugs").runContentSlugCheck(args),
  "content-manifest": (args) => {
    const checks = require("./quality/checks/content-manifest");
    return checks.runContentManifestGenerator(
      checks.createContentManifestContext(),
      { check: args.includes("--check") },
    );
  },
  translations: () =>
    require("./quality/checks/translations").runTranslationCheck(),
  "message-key-usage": () =>
    require("./quality/checks/message-key-usage").runMessageKeyUsageCheck(),
  "validate-production-config": () =>
    require("./quality/checks/production-config").runValidateProductionConfigCli(),
  "component-governance": () =>
    require("./quality/checks/component-governance").runComponentGovernanceCli(),
  "content-readiness": (args) =>
    require("./quality/checks/content-readiness").runContentReadinessCli(args),
  "client-boundary": (args) =>
    require("./quality/checks/client-boundary").runClientBoundaryCli(args),
  "prerender-static": () =>
    require("./quality/checks/prerender-static").runPrerenderStaticCheck(),
  "cf-preview-smoke": (args) =>
    require("./quality/checks/cloudflare-smoke").runCloudflarePreviewSmoke(
      args,
    ),
  "external-url-smoke": (args) =>
    require("./quality/checks/cloudflare-smoke").runExternalUrlSmoke(args),
  "deployed-smoke": (args) =>
    require("./quality/checks/cloudflare-smoke").runDeployedSmoke(args),
  "cf-preview-deployed": () =>
    require("./quality/checks/cloudflare-smoke").runCloudflarePreviewDeployedProof(),
  "cf-official-compare": (args) =>
    require("./quality/checks/cloudflare-official-compare").runCloudflareOfficialCompareCli(
      args,
    ),
  "cf-static-asset-headers": () =>
    require("./quality/checks/cloudflare-static-asset-headers").runCloudflareStaticAssetHeaderCli(
      { rootDir: ROOT },
    ),
  "release-verify": () =>
    require("./quality/checks/release-verify").runReleaseVerify({
      rootDir: ROOT,
    }),
  "--help": () => {
    printUsage();
    return true;
  },
  "-h": () => {
    printUsage();
    return true;
  },
};

const STARTER_CHECK_COMMANDS = Object.keys(COMMAND_HANDLERS).filter(
  (command) => !command.startsWith("-"),
);

async function main(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;
  const handler = COMMAND_HANDLERS[command];
  const ok = handler ? await handler(args) : false;

  if (!handler) {
    printUsage();
  }

  if (typeof ok === "number") {
    process.exitCode = ok;
  } else if (!ok) {
    process.exitCode = 1;
  }
}

module.exports = { STARTER_CHECK_COMMANDS };

if (require.main === module) {
  main().catch((error) => {
    console.error("[starter-checks] Unexpected error:", error);
    process.exit(1);
  });
}
