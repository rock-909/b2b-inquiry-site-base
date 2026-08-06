const fs = require("node:fs");
const path = require("node:path");
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
const REQUIRED_R2_BINDINGS = [
  {
    environment: "preview",
    bucketName: "tucsenberg-site-cache-preview",
  },
  {
    environment: "production",
    bucketName: "tucsenberg-site-cache-production",
  },
];
const OPEN_NEXT_DRAFT_DEPENDENCY =
  "https://pkg.pr.new/@opennextjs/cloudflare@69807b1";

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
const DESTRUCTIVE_DEPLOY_SCRIPT_SNIPPETS = [
  "wrangler delete",
  "deleted_classes",
  "new_sqlite_classes",
];
const RETIRED_SCRIPT_NAMES = [
  "build:cf",
  "deploy:cf",
  "deploy:cf:dry-run",
  "proof:cf:preview-deployed",
];

function readCloudflareCompareFile(rootDir, relPath) {
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

function hasOpenNextIncrementalCacheWiring(text) {
  const source = ts.createSourceFile(
    "open-next.config.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  const configInitializers = new Map();
  const defineCloudflareConfigImports = new Set();
  const r2IncrementalCacheImports = new Set();

  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteralLike(statement.moduleSpecifier)
    ) {
      continue;
    }
    const moduleName = statement.moduleSpecifier.text;
    const importClause = statement.importClause;
    const namedBindings = importClause?.namedBindings;
    if (
      moduleName === "@opennextjs/cloudflare" &&
      namedBindings &&
      ts.isNamedImports(namedBindings)
    ) {
      const imported = namedBindings.elements.find(
        (element) =>
          (element.propertyName ?? element.name).text ===
          "defineCloudflareConfig",
      );
      if (imported) {
        defineCloudflareConfigImports.add(imported.name.text);
      }
    }
    if (
      moduleName ===
        "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache" &&
      importClause?.name
    ) {
      r2IncrementalCacheImports.add(importClause.name.text);
    }
  }

  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        configInitializers.set(declaration.name.text, declaration.initializer);
      }
    }
  }

  const isConfiguredCall = (node) => {
    if (
      !node ||
      !ts.isCallExpression(node) ||
      !ts.isIdentifier(node.expression) ||
      !defineCloudflareConfigImports.has(node.expression.text)
    ) {
      return false;
    }
    const config = node.arguments[0];
    if (!config || !ts.isObjectLiteralExpression(config)) return false;

    return config.properties.some(
      (property) =>
        ts.isPropertyAssignment(property) &&
        (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
        property.name.text === "incrementalCache" &&
        ts.isIdentifier(property.initializer) &&
        r2IncrementalCacheImports.has(property.initializer.text),
    );
  };

  return source.statements.some((statement) => {
    if (!ts.isExportAssignment(statement) || statement.isExportEquals) {
      return false;
    }
    if (isConfiguredCall(statement.expression)) return true;
    return (
      ts.isIdentifier(statement.expression) &&
      isConfiguredCall(configInitializers.get(statement.expression.text))
    );
  });
}

function checkWrangler(rootDir, failures) {
  const config = parseWranglerConfig(
    readCloudflareCompareFile(rootDir, "wrangler.jsonc"),
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
  for (const binding of REQUIRED_R2_BINDINGS) {
    const buckets = getConfigValue(config, [
      "env",
      binding.environment,
      "r2_buckets",
    ]);
    const hasBinding =
      Array.isArray(buckets) &&
      buckets.some(
        (bucket) =>
          bucket?.binding === "NEXT_INC_CACHE_R2_BUCKET" &&
          bucket?.bucket_name === binding.bucketName,
      );
    if (!hasBinding) {
      missing.push(
        `env.${binding.environment}.r2_buckets: NEXT_INC_CACHE_R2_BUCKET -> ${binding.bucketName}`,
      );
    }
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
  const text = readCloudflareCompareFile(rootDir, "open-next.config.ts");
  const tokens = collectSourceTokens("open-next.config.ts", text);
  const missing = hasOpenNextIncrementalCacheWiring(text)
    ? []
    : ["incrementalCache: r2IncrementalCache"];
  const forbidden = OPEN_NEXT_FORBIDDEN_TOKENS.filter((token) =>
    tokens.has(token),
  );

  if (missing.length > 0 || forbidden.length > 0) {
    failures.push({
      file: "open-next.config.ts",
      label:
        "OpenNext config keeps the approved R2 incremental cache without split topology",
      missing,
      forbidden,
    });
  }
}

function checkPackageScripts(rootDir, failures) {
  const packageJson = JSON.parse(
    readCloudflareCompareFile(rootDir, "package.json"),
  );
  const scripts = packageJson.scripts ?? {};
  if (
    packageJson.devDependencies?.["@opennextjs/cloudflare"] !==
    OPEN_NEXT_DRAFT_DEPENDENCY
  ) {
    failures.push({
      file: "package.json",
      label:
        "OpenNext Cache Components adapter stays pinned to the reviewed commit",
      missing: [`@opennextjs/cloudflare: ${OPEN_NEXT_DRAFT_DEPENDENCY}`],
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

    if (typeof script === "string") {
      const forbidden = [
        ...DESTRUCTIVE_DEPLOY_SCRIPT_SNIPPETS,
        "&&",
        "||",
        ";",
      ].filter((snippet) => script.includes(snippet));
      if (forbidden.length > 0) {
        failures.push({
          file: "package.json",
          label:
            "Cloudflare build alias must stay exact and must not chain destructive actions",
          missing: [],
          forbidden,
        });
      }
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

function collectCloudflareOfficialCompareFailures(rootDir = ROOT) {
  const failures = [];
  checkWrangler(rootDir, failures);
  checkOpenNextConfig(rootDir, failures);
  checkPackageScripts(rootDir, failures);
  return failures;
}

function runCloudflareOfficialCompareCli(args = []) {
  const unknownArgs = args.filter((arg) => arg !== "--source-only");
  if (unknownArgs.length > 0) {
    console.error(
      `cf-official-compare: unknown argument: ${unknownArgs.join(", ")}`,
    );
    return false;
  }

  const sourceOnly = args.includes("--source-only");

  const failures = collectCloudflareOfficialCompareFailures();

  if (failures.length > 0) {
    console.error("cf-official-compare: failed");
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

  console.log("cf-official-compare: passed");
  if (sourceOnly) {
    console.log(
      "Verified the pinned OpenNext adapter, R2 source topology, and package deploy aliases.",
    );
  } else {
    console.log(
      "Verified the pinned OpenNext adapter and R2 source topology. Native deploy-artifact proof is covered by wrangler deploy --dry-run.",
    );
  }

  return true;
}

module.exports = {
  collectCloudflareOfficialCompareFailures,
  runCloudflareOfficialCompareCli,
};
