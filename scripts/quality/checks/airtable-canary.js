const { spawnSync } = require("node:child_process");
const {
  isDeployedCanaryUrl,
} = require("../../../tests/e2e/smoke/post-deploy-canary-url.ts");

const CANARY_SPEC = "tests/e2e/smoke/post-deploy-form.spec.ts";

/** @param {Record<string, string | undefined>} [env] */
function collectMissingAirtableCanaryInputs(env = process.env) {
  const targetUrl = env.STAGING_URL || env.PLAYWRIGHT_BASE_URL;
  const missing = [];

  if (!isDeployedCanaryUrl(targetUrl)) {
    missing.push("STAGING_URL or PLAYWRIGHT_BASE_URL (deployed HTTPS URL)");
  }
  if (!env.AIRTABLE_BASE_ID) missing.push("AIRTABLE_BASE_ID");
  if (!env.AIRTABLE_API_KEY) missing.push("AIRTABLE_API_KEY");

  return missing;
}

/** @param {Record<string, string | undefined>} [env] */
function runAirtableCanary(env = process.env) {
  const missing = collectMissingAirtableCanaryInputs(env);
  if (missing.length > 0) {
    console.error(
      `Airtable canary 缺少前置条件：\n${missing.map((name) => `- ${name}`).join("\n")}`,
    );
    return 1;
  }

  const result = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "playwright", "test", CANARY_SPEC],
    {
      env: { ...env, POST_DEPLOY_TEST: "1" },
      stdio: "inherit",
    },
  );

  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

module.exports = { collectMissingAirtableCanaryInputs, runAirtableCanary };

if (require.main === module) {
  process.exitCode = runAirtableCanary();
}
