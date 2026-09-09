const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");
const ts = require("typescript");

const ROOT = process.cwd();

// Required real config, checked against parsed structure (not raw text) so that
// comments can neither satisfy a required value nor trip a forbidden one.
const WRANGLER_REQUIRED_FIELDS = [
  { path: ["main"], expected: ".open-next/worker.js" },
  { path: ["assets", "binding"], expected: "ASSETS" },
];
const WRANGLER_REQUIRED_COMPAT_FLAGS = [
  "nodejs_compat",
  "global_fetch_strictly_public",
];
const REQUIRED_R2_ENVIRONMENTS = ["preview", "production"];
const OPEN_NEXT_STABLE_DEPENDENCY = "1.20.6";

// Split-topology surfaces that a passing build + wrangler dry-run would not
// catch. R2 is intentional; D1/DO/queue expansion still needs a new proof lane.
const WRANGLER_FORBIDDEN_TOKENS = [
  "WORKER_SELF_REFERENCE",
  "NEXT_TAG_CACHE_D1",
  "NEXT_CACHE_DO_QUEUE",
  "durable_objects",
  "d1_databases",
  "migrations",
];

const OPEN_NEXT_FORBIDDEN_TOKENS = [
  "doQueue",
  "d1NextTagCache",
  "functions",
  "apiLead",
  "apiOps",
  "/api/cache/invalidate",
];

const CLOUDFLARE_SCRIPT_SURFACE_CHECKS = [
  {
    name: "website:build:cf",
    expected:
      "DEPLOYMENT_PLATFORM=cloudflare NEXT_PUBLIC_DEPLOYMENT_PLATFORM=cloudflare pnpm exec opennextjs-cloudflare build",
  },
  {
    name: "website:build:cf:debug",
    expected:
      "DEPLOYMENT_PLATFORM=cloudflare NEXT_PUBLIC_DEPLOYMENT_PLATFORM=cloudflare pnpm exec opennextjs-cloudflare build --noMinify",
  },
];
const RETIRED_SCRIPT_NAMES = [
  "build:cf",
  "deploy:cf",
  "deploy:cf:dry-run",
  "proof:cf:preview-deployed",
];

function readCloudflareConfigFile(rootDir, relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), "utf8");
}

// wrangler.jsonc is JSONC (comments + trailing commas); the TypeScript config
// reader parses it to a real object. Never regex-strip comments — that is the
// same raw-text bug class this check exists to remove.
function parseWranglerConfig(text) {
  const { config, error } = ts.parseConfigFileTextToJson(
    "wrangler.jsonc",
    text,
  );
  if (error) {
    throw new Error(
      `wrangler.jsonc parse failed: ${ts.flattenDiagnosticMessageText(error.messageText, "\n")}`,
    );
  }
  return config ?? {};
}

function getConfigValue(config, keyPath) {
  return keyPath.reduce(
    (node, key) => (node && typeof node === "object" ? node[key] : undefined),
    config,
  );
}

// Collect identifier and string-literal token values from a TS source. Comments
// are scanner trivia, so they cannot satisfy or trip any token check.
function collectSourceTokens(relPath, text) {
  const source = ts.createSourceFile(
    relPath,
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  const tokens = new Set();
  const visit = (node) => {
    if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) {
      tokens.add(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return tokens;
}

/**
 * 在隔离子进程里真实执行 <rootDir>/open-next.config.ts，并用
 * 安装的 OpenNext stable 验证 R2 incremental cache 最终接线。
 */
function checkOpenNextWiring(rootDir, failures) {
  const runnerPath = path.join(
    __dirname,
    "cloudflare-config-open-next-runner.mjs",
  );
  let stdout;
  try {
    stdout = childProcess.execFileSync(
      process.execPath,
      [runnerPath, rootDir],
      {
        encoding: "utf8",
        timeout: 30_000,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
  } catch (error) {
    failures.push({
      file: "open-next.config.ts",
      label:
        "OpenNext config keeps the approved R2 incremental cache without split topology",
      missing: [
        `open-next.config.ts failed to load with the installed OpenNext package: ${String(error)}`,
      ],
      forbidden: [],
    });
    return;
  }

  let result;
  try {
    result = JSON.parse(stdout);
  } catch {
    result = {
      ok: false,
      missing: ["unparseable harness output"],
      forbidden: [],
    };
  }

  if (!result.ok) {
    failures.push({
      file: "open-next.config.ts",
      label:
        "OpenNext config keeps the approved R2 incremental cache without split topology",
      missing: Array.isArray(result.missing)
        ? result.missing
        : ["unknown wiring failure"],
      forbidden: [],
    });
  }
}

function checkWrangler(rootDir, failures) {
  const config = parseWranglerConfig(
    readCloudflareConfigFile(rootDir, "wrangler.jsonc"),
  );

  const missing = [];
  for (const field of WRANGLER_REQUIRED_FIELDS) {
    if (getConfigValue(config, field.path) !== field.expected) {
      missing.push(`${field.path.join(".")}: ${field.expected}`);
    }
  }
  const compatFlags = Array.isArray(config.compatibility_flags)
    ? config.compatibility_flags
    : [];
  for (const flag of WRANGLER_REQUIRED_COMPAT_FLAGS) {
    if (!compatFlags.includes(flag)) {
      missing.push(`compatibility_flags: ${flag}`);
    }
  }
  const r2BucketNames = {};
  for (const environment of REQUIRED_R2_ENVIRONMENTS) {
    const buckets = getConfigValue(config, ["env", environment, "r2_buckets"]);
    const binding = Array.isArray(buckets)
      ? buckets.find((bucket) => bucket?.binding === "NEXT_INC_CACHE_R2_BUCKET")
      : undefined;
    const bucketName =
      typeof binding?.bucket_name === "string"
        ? binding.bucket_name.trim()
        : "";
    if (!bucketName) {
      missing.push(
        `env.${environment}.r2_buckets: NEXT_INC_CACHE_R2_BUCKET with non-empty bucket_name`,
      );
    } else {
      r2BucketNames[environment] = bucketName;
    }
  }
  if (
    r2BucketNames.preview &&
    r2BucketNames.preview === r2BucketNames.production
  ) {
    missing.push(
      "env.preview and env.production NEXT_INC_CACHE_R2_BUCKET bindings must use different bucket_name values",
    );
  }

  // Comments are already gone from the parsed object; searching its canonical
  // JSON only matches real configuration values.
  // ponytail: substring over canonical JSON; switch to keyed structural checks
  // only if a legitimate value ever collides with a forbidden token.
  const canonical = JSON.stringify(config);
  const forbidden = WRANGLER_FORBIDDEN_TOKENS.filter((token) =>
    canonical.includes(token),
  );

  if (missing.length > 0 || forbidden.length > 0) {
    failures.push({
      file: "wrangler.jsonc",
      label:
        "Wrangler config keeps the approved preview/production R2 topology",
      missing,
      forbidden,
    });
  }
}

function checkOpenNextConfig(rootDir, failures) {
  // 精确 token 扫描保留：注释不触发、更长标识符不误报，用于
  // 阻止运行时最终 shape 无法区分的已退役拓扑。
  const text = readCloudflareConfigFile(rootDir, "open-next.config.ts");
  const tokens = collectSourceTokens("open-next.config.ts", text);
  const forbidden = OPEN_NEXT_FORBIDDEN_TOKENS.filter((token) =>
    tokens.has(token),
  );

  if (forbidden.length > 0) {
    failures.push({
      file: "open-next.config.ts",
      label:
        "OpenNext config keeps the approved R2 incremental cache without split topology",
      missing: [],
      forbidden,
    });
    return;
  }

  checkOpenNextWiring(rootDir, failures);
}

function checkPackageScripts(rootDir, failures) {
  const packageJson = JSON.parse(
    readCloudflareConfigFile(rootDir, "package.json"),
  );
  const scripts = packageJson.scripts ?? {};
  if (
    packageJson.devDependencies?.["@opennextjs/cloudflare"] !==
    OPEN_NEXT_STABLE_DEPENDENCY
  ) {
    failures.push({
      file: "package.json",
      label: "OpenNext stays pinned to the reviewed stable release",
      missing: [`@opennextjs/cloudflare: ${OPEN_NEXT_STABLE_DEPENDENCY}`],
      forbidden: [],
    });
  }

  for (const check of CLOUDFLARE_SCRIPT_SURFACE_CHECKS) {
    const script = scripts[check.name];
    if (script !== check.expected) {
      failures.push({
        file: "package.json",
        label:
          "stable Cloudflare build entrypoint must use the native OpenNext Cloudflare CLI",
        missing: [`${check.name}: ${check.expected}`],
        forbidden: [],
      });
    }
  }

  const retired = RETIRED_SCRIPT_NAMES.filter((name) =>
    Object.prototype.hasOwnProperty.call(scripts, name),
  );
  if (retired.length > 0) {
    failures.push({
      file: "package.json",
      label:
        "advanced Cloudflare deploy/proof commands stay as direct scripts, not public package aliases",
      missing: [],
      forbidden: retired,
    });
  }
}

function collectCloudflareConfigFailures(rootDir = ROOT) {
  const failures = [];
  checkWrangler(rootDir, failures);
  checkOpenNextConfig(rootDir, failures);
  checkPackageScripts(rootDir, failures);
  return failures;
}

function runCloudflareConfigCheckCli() {
  const failures = collectCloudflareConfigFailures();

  if (failures.length > 0) {
    console.error("cloudflare-config-check: failed");
    for (const failure of failures) {
      console.error(`- ${failure.file}: ${failure.label}`);
      for (const snippet of failure.missing) {
        console.error(`  - missing config: ${snippet}`);
      }
      for (const snippet of failure.forbidden) {
        console.error(`  - forbidden config still present: ${snippet}`);
      }
    }
    return false;
  }

  console.log("cloudflare-config-check: passed");
  console.log(
    "Verified the stable OpenNext release, R2 source topology, and package build aliases.",
  );

  return true;
}

if (require.main === module) {
  if (!runCloudflareConfigCheckCli()) {
    process.exitCode = 1;
  }
}

module.exports = {
  collectCloudflareConfigFailures,
  runCloudflareConfigCheckCli,
};
