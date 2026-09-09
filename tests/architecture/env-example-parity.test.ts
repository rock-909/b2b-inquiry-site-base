import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ENV_SOURCE_PATH = "src/lib/env.ts";
const ENV_EXAMPLE_PATH = ".env.example";
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
const NON_RUNTIME_EXAMPLE_ENV_KEYS = new Set([
  "CLOUDFLARE_API_TOKEN",
  "CI_FULL_COVERAGE",
  "CI_FLAKE_SAMPLING",
  "CLOUDFLARE_PREVIEW_BASE_URL",
  "DEPLOY_SMOKE_BASE_URL",
  "DEPLOY_SMOKE_HEADER_NAME",
  "DEPLOY_SMOKE_HEADER_VALUE",
  "PLAYWRIGHT_BASE_URL",
  "PLAYWRIGHT_REBUILD_SERVER",
  "PLAYWRIGHT_REUSE_EXISTING_SERVER",
  "POST_DEPLOY_TEST",
  "STAGING_URL",
]);
const FRAMEWORK_MANAGED_RUNTIME_KEYS = new Set(["NEXT_PHASE", "NODE_ENV"]);
const PUBLIC_RUNTIME_ENV_SOURCE_PATH = "src/lib/public-runtime-env.ts";
// NODE_ENV 由框架注入；NEXT_PUBLIC_APP_ENV 由 next.config.ts 在构建时从
// APP_ENV 派生（映射本身由 next-config-contract 的行为断言证明）。两者都不是
// 用户输入，所以在 client schema 登记要求中显式豁免。
const FRAMEWORK_PUBLIC_ENV_KEYS = new Set(["NODE_ENV"]);
const DERIVED_PUBLIC_ENV_KEYS = new Set(["NEXT_PUBLIC_APP_ENV"]);

function readRepoFile(repoPath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads fixed repo-local files
  return readFileSync(repoPath, "utf8");
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

function unwrapLiteralExpression(expression: ts.Expression): ts.Expression {
  // `as const satisfies …` 会把对象字面量包进 SatisfiesExpression，直接判
  // initializer 的 kind 会漏掉这类声明。
  return ts.isSatisfiesExpression(expression) || ts.isAsExpression(expression)
    ? unwrapLiteralExpression(expression.expression)
    : expression;
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
      node.initializer
    ) {
      const unwrapped = unwrapLiteralExpression(node.initializer);

      if (ts.isObjectLiteralExpression(unwrapped)) {
        objectLiteral = unwrapped;
        return;
      }
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

  // public-runtime-env 的 allowlist 是客户端读 env 的唯一合法入口。它每多一个
  // key 就绕过一次中心 schema 的登记，而上面的扫描根恰好不含 src/，这条漂移
  // 只有这里能看见。只守「allowlist 的读取都有登记」这一个方向：反向（schema
  // 每个 key 都要进 allowlist）不是已证明的契约，不做。
  it("keeps public runtime allowlist reads registered in the client env schema", () => {
    const allowlistKeys = extractObjectLiteralKeys(
      readRepoFile(PUBLIC_RUNTIME_ENV_SOURCE_PATH),
      "PUBLIC_RUNTIME_ENV_READERS",
    );
    const clientSchemaKeys = new Set(
      extractObjectLiteralKeys(
        readRepoFile(ENV_SOURCE_PATH),
        "clientEnvSchema",
      ),
    );

    // 豁免名单里的 key 必须真的还在 allowlist 里：key 被删除时豁免也要跟着缩，
    // 不能留一张永远为真的豁免表。
    for (const key of [
      ...FRAMEWORK_PUBLIC_ENV_KEYS,
      ...DERIVED_PUBLIC_ENV_KEYS,
    ]) {
      expect(
        allowlistKeys,
        `${key} should stay on the public allowlist`,
      ).toContain(key);
    }

    const unregistered = allowlistKeys.filter(
      (key) =>
        !clientSchemaKeys.has(key) &&
        !FRAMEWORK_PUBLIC_ENV_KEYS.has(key) &&
        !DERIVED_PUBLIC_ENV_KEYS.has(key),
    );

    expect(sortedStrings(unregistered)).toEqual([]);
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
