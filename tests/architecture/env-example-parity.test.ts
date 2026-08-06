import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ENV_SOURCE_PATH = "src/lib/env.ts";
const ENV_EXAMPLE_PATH = ".env.example";
const DEV_VARS_EXAMPLE_PATH = ".dev.vars.example";
const SENSITIVE_ENV_KEY_PATTERN =
  /(?:_API_KEY|_TOKEN|_SECRET(?:_KEY)?|_ACCESS_KEY|_ENCRYPTION_KEY|_PEPPER(?:_PREVIOUS)?)$/u;
const SENSITIVE_ENV_KEYS = [
  "RESEND_API_KEY",
  "AIRTABLE_API_KEY",
  "TURNSTILE_SECRET_KEY",
  "CLOUDFLARE_API_TOKEN",
  "RATE_LIMIT_PEPPER",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;
// This is the adopter-facing deployment surface, not inferred from secret-like names.
const DEPLOYMENT_CRITICAL_ENV_KEYS = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "DEPLOYMENT_PLATFORM",
] as const;
const TOOLING_PROOF_ENV_KEYS = [
  "CI_DAILY",
  "CI_FLAKE_SAMPLING",
  "CLOUDFLARE_PREVIEW_BASE_URL",
  "DEPLOY_SMOKE_BASE_URL",
  "DEPLOY_SMOKE_HEADER_NAME",
  "DEPLOY_SMOKE_HEADER_VALUE",
  "PLAYWRIGHT_BASE_URL",
  "PLAYWRIGHT_PROFILE_LANE",
  "PLAYWRIGHT_REBUILD_SERVER",
  "POST_DEPLOY_TEST",
  "STAGING_URL",
] as const;
const NON_RUNTIME_EXAMPLE_ENV_KEYS = new Set([
  "CLOUDFLARE_API_TOKEN",
  ...TOOLING_PROOF_ENV_KEYS,
]);
const FRAMEWORK_MANAGED_RUNTIME_KEYS = new Set(["NEXT_PHASE", "NODE_ENV"]);
const TEST_INTERNAL_ENV_KEYS = new Set(["VITEST", "VITEST_WORKER_ID"]);
const TOOLING_ENV_USAGE_ROOTS = [
  "scripts/starter-checks.js",
  "scripts/quality/checks",
  "playwright.config.ts",
  "tests/e2e",
] as const;

function readRepoFile(repoPath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads fixed repo-local files
  return readFileSync(repoPath, "utf8");
}

function collectFiles(repoPath: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test recursively scans fixed repo-local tooling roots
  const stats = statSync(repoPath);

  if (stats.isFile()) {
    return [repoPath];
  }

  const files: string[] = [];

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test recursively scans fixed repo-local tooling roots
  for (const entry of readdirSync(repoPath)) {
    for (const filePath of collectFiles(join(repoPath, entry))) {
      if (/\.(?:js|mjs|ts|tsx)$/u.test(filePath)) {
        files.push(filePath);
      }
    }
  }

  return files;
}

function createSourceFile(source: string) {
  return ts.createSourceFile(
    ENV_SOURCE_PATH,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function getPropertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text;
  }

  if (ts.isNumericLiteral(name)) {
    return name.text;
  }

  return null;
}

function findObjectLiteral(
  source: string,
  variableName: string,
): ts.ObjectLiteralExpression {
  const sourceFile = createSourceFile(source);
  let objectLiteral: ts.ObjectLiteralExpression | null = null;

  function visit(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      objectLiteral = node.initializer;
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!objectLiteral) {
    throw new Error(`${variableName} should be an object literal`);
  }

  return objectLiteral;
}

function extractObjectLiteralKeys(source: string, variableName: string) {
  const objectLiteral = findObjectLiteral(source, variableName);

  return objectLiteral.properties.flatMap((property) => {
    if (!ts.isPropertyAssignment(property)) {
      return [];
    }

    const key = getPropertyName(property.name);
    return key ? [key] : [];
  });
}

function extractRuntimeEnvKeys(source: string) {
  const objectLiteral = findObjectLiteral(source, "runtimeEnv");

  return objectLiteral.properties.flatMap((property) => {
    if (
      !ts.isPropertyAssignment(property) ||
      !ts.isPropertyAccessExpression(property.initializer)
    ) {
      return [];
    }

    const key = getPropertyName(property.name);
    const envKey = property.initializer.name.text;
    const envObject = property.initializer.expression;

    if (
      !key ||
      key !== envKey ||
      !ts.isPropertyAccessExpression(envObject) ||
      envObject.name.text !== "env" ||
      !ts.isIdentifier(envObject.expression) ||
      envObject.expression.text !== "process"
    ) {
      return [];
    }

    return [key];
  });
}

function extractProcessEnvKeys(source: string) {
  const keys: string[] = [];

  for (const match of source.matchAll(
    /process\.env(?:\.([A-Z0-9_]+)|\[['"]([A-Z0-9_]+)['"]\])/gu,
  )) {
    const key = match[1] ?? match[2];
    if (key) {
      keys.push(key);
    }
  }

  return keys;
}

function getSchemaKeys(envSource: string) {
  return new Set([
    ...extractObjectLiteralKeys(envSource, "serverEnvSchema"),
    ...extractObjectLiteralKeys(envSource, "clientEnvSchema"),
  ]);
}

function parseEnvExample(source: string) {
  const values = new Map<string, string>();

  for (const line of source.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    const match = /^([A-Z0-9_]+)=(.*)$/u.exec(trimmed);
    const key = match?.[1];
    if (key) {
      values.set(key, match[2] ?? "");
    }
  }

  return values;
}

function getDiscoveredSensitiveEnvKeys(envExample: Map<string, string>) {
  return [...envExample.keys()].filter((key) =>
    SENSITIVE_ENV_KEY_PATTERN.test(key),
  );
}

function sortedStrings(values: Iterable<string>) {
  return Array.from(values).sort();
}

describe(".env.example parity", () => {
  it("keeps env example aligned with the central runtime env contract", () => {
    const envSource = readRepoFile(ENV_SOURCE_PATH);
    const envExample = parseEnvExample(readRepoFile(ENV_EXAMPLE_PATH));
    const schemaKeys = getSchemaKeys(envSource);
    const runtimeKeys = new Set<string>(extractRuntimeEnvKeys(envSource));

    expect(sortedStrings(schemaKeys)).toEqual(sortedStrings(runtimeKeys));

    const documentedRuntimeKeys = new Set<string>(
      [...envExample.keys()].filter(
        (key) => !NON_RUNTIME_EXAMPLE_ENV_KEYS.has(key),
      ),
    );
    const missingFromExample: string[] = [];
    const unknownExampleKeys: string[] = [];

    for (const key of schemaKeys) {
      if (
        !FRAMEWORK_MANAGED_RUNTIME_KEYS.has(key) &&
        !documentedRuntimeKeys.has(key)
      ) {
        missingFromExample.push(key);
      }
    }

    for (const key of envExample.keys()) {
      if (!schemaKeys.has(key) && !NON_RUNTIME_EXAMPLE_ENV_KEYS.has(key)) {
        unknownExampleKeys.push(key);
      }
    }

    missingFromExample.sort();
    unknownExampleKeys.sort();

    expect(missingFromExample).toEqual([]);
    expect(unknownExampleKeys).toEqual([]);
    expect(envExample.get("CLOUDFLARE_API_TOKEN")).toBeDefined();
    expect(schemaKeys.has("CLOUDFLARE_API_TOKEN")).toBe(false);
  });

  it("keeps tooling and proof env keys used outside the runtime schema in the env example", () => {
    const envSource = readRepoFile(ENV_SOURCE_PATH);
    const schemaKeys = getSchemaKeys(envSource);
    const envExample = parseEnvExample(readRepoFile(ENV_EXAMPLE_PATH));
    const discoveredToolingKeys = new Set<string>();

    for (const root of TOOLING_ENV_USAGE_ROOTS) {
      for (const filePath of collectFiles(root)) {
        for (const key of extractProcessEnvKeys(readRepoFile(filePath))) {
          if (!schemaKeys.has(key) && !TEST_INTERNAL_ENV_KEYS.has(key)) {
            discoveredToolingKeys.add(key);
          }
        }
      }
    }

    expect(sortedStrings(discoveredToolingKeys)).toEqual(
      sortedStrings(TOOLING_PROOF_ENV_KEYS),
    );

    for (const key of TOOLING_PROOF_ENV_KEYS) {
      expect(envExample.has(key), `${key} should remain in .env.example`).toBe(
        true,
      );
    }
  });

  it("keeps dangerous or behavior-sensitive defaults safe", () => {
    const envExampleSource = readRepoFile(ENV_EXAMPLE_PATH);
    const envExample = parseEnvExample(envExampleSource);

    expect(envExample.get("ALLOW_MEMORY_RATE_LIMIT")).toBe("false");
    expect(envExampleSource).toContain(
      "Memory rate limiting is automatic in development/test when Upstash is not configured.",
    );
    expect(envExampleSource).toContain(
      "ALLOW_MEMORY_RATE_LIMIT=true is a release/proof blocker, not the switch that enables fallback.",
    );
    expect(envExampleSource).not.toContain(
      "Set ALLOW_MEMORY_RATE_LIMIT=true only for local fallback.",
    );
  });

  it("documents the current Turnstile env surface and inquiry action contract", () => {
    const envSource = readRepoFile(ENV_SOURCE_PATH);
    const envExample = parseEnvExample(readRepoFile(ENV_EXAMPLE_PATH));
    const schemaKeys = getSchemaKeys(envSource);
    const turnstileConstants = readRepoFile(
      "src/constants/turnstile-constants.ts",
    );
    const turnstileVerifier = readRepoFile("src/lib/security/turnstile.ts");

    for (const key of [
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
      "TURNSTILE_SECRET_KEY",
      "TURNSTILE_ALLOWED_HOSTS",
      "TURNSTILE_BYPASS",
      "NEXT_PUBLIC_TURNSTILE_BYPASS",
    ] as const) {
      expect(schemaKeys.has(key), `${key} should stay in env schema`).toBe(
        true,
      );
      expect(envExample.has(key), `${key} should stay in .env.example`).toBe(
        true,
      );
    }

    expect(turnstileConstants).toContain(
      'INQUIRY_TURNSTILE_ACTION = "product_inquiry"',
    );
    expect(turnstileVerifier).toContain("INQUIRY_TURNSTILE_ACTION");
  });

  it("keeps the Cloudflare local preview env example explicit about its limited scope", () => {
    const devVarsExample = readRepoFile(DEV_VARS_EXAMPLE_PATH);
    const requiredBoundaryText = [
      "Cloudflare local preview minimal example",
      ".env.example",
      "RATE_LIMIT_PEPPER",
      "UPSTASH_REDIS_REST_URL",
    ];

    for (const text of requiredBoundaryText) {
      expect(
        devVarsExample,
        `${DEV_VARS_EXAMPLE_PATH} should mention ${text}`,
      ).toContain(text);
    }
  });

  it("keeps all sensitive keys in the env example and server-only", () => {
    const envExample = parseEnvExample(readRepoFile(ENV_EXAMPLE_PATH));
    const sensitiveEnvKeys = sortedStrings(
      new Set([
        ...SENSITIVE_ENV_KEYS,
        ...getDiscoveredSensitiveEnvKeys(envExample),
      ]),
    );
    const publicSensitiveKeys = [...envExample.keys()].filter(
      (key) =>
        key.startsWith("NEXT_PUBLIC_") && SENSITIVE_ENV_KEY_PATTERN.test(key),
    );

    expect(publicSensitiveKeys).toEqual([]);

    for (const key of sensitiveEnvKeys) {
      expect(envExample.has(key), `${key} should remain in .env.example`).toBe(
        true,
      );
      expect(
        key.startsWith("NEXT_PUBLIC_"),
        `${key} must stay server-only and must not be public`,
      ).toBe(false);
    }
  });

  it("keeps deployment-critical keys in the env example", () => {
    const envExample = parseEnvExample(readRepoFile(ENV_EXAMPLE_PATH));

    for (const key of DEPLOYMENT_CRITICAL_ENV_KEYS) {
      expect(envExample.has(key), `${key} should remain in .env.example`).toBe(
        true,
      );
    }
  });
});
