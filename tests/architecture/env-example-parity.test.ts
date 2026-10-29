import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const ENV_EXAMPLE_PATH = ".env.example";
const SENSITIVE_ENV_KEY_PATTERN =
  /(?:_API_KEY|_TOKEN|_SECRET(?:_KEY)?|_ACCESS_KEY|_ENCRYPTION_KEY|_PEPPER(?:_PREVIOUS)?)$/u;
const NON_RUNTIME_EXAMPLE_ENV_KEYS = new Set([
  "CLOUDFLARE_ACCOUNT_ID",
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
const FRAMEWORK_MANAGED_RUNTIME_KEYS = new Set(["NODE_ENV"]);
const PUBLIC_RUNTIME_ENV_SOURCE_PATH = "src/lib/public-runtime-env.ts";
// NODE_ENV 由框架注入；NEXT_PUBLIC_APP_ENV 由 next.config.ts 在构建时从
// APP_ENV 派生（映射本身由 next-config-contract 的行为断言证明）；
// PUBLIC_ASSET_PATHS 由 next.config.ts 在构建时扫描 public/ 生成。它们都不是
// 用户输入，所以在 client schema 登记要求中显式豁免。
const FRAMEWORK_PUBLIC_ENV_KEYS = new Set(["NODE_ENV"]);
const DERIVED_PUBLIC_ENV_KEYS = new Set([
  "NEXT_PUBLIC_APP_ENV",
  "PUBLIC_ASSET_PATHS",
]);

// 全局 setup 把 @/lib/env 整体 mock 了，这里要的是真实导出的 schema 与 runtimeEnv。
const { clientEnvSchema, runtimeEnv, serverEnvSchema } =
  await vi.importActual<typeof import("@/lib/env")>("@/lib/env");

function readRepoFile(repoPath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads fixed repo-local files
  return readFileSync(repoPath, "utf8");
}

function extractObjectLiteralKeys(source: string, variableName: string) {
  const sourceFile = ts.createSourceFile(
    PUBLIC_RUNTIME_ENV_SOURCE_PATH,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const keys: string[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName &&
      node.initializer
    ) {
      let initializer = node.initializer;
      while (
        ts.isSatisfiesExpression(initializer) ||
        ts.isAsExpression(initializer)
      ) {
        initializer = initializer.expression;
      }
      if (ts.isObjectLiteralExpression(initializer)) {
        for (const property of initializer.properties) {
          if (
            ts.isPropertyAssignment(property) &&
            (ts.isIdentifier(property.name) ||
              ts.isStringLiteral(property.name) ||
              ts.isNoSubstitutionTemplateLiteral(property.name))
          ) {
            keys.push(property.name.text);
          }
        }
      }
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return keys;
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

function sortedStrings(values: Iterable<string>) {
  return Array.from(values).sort();
}

describe(".env.example parity", () => {
  // runtimeEnv 必须逐项手写 KEY: process.env.KEY；接错名字时 schema 校验看不出来。
  it("wires every runtimeEnv key to the process.env variable of the same name", async () => {
    for (const key of Object.keys(runtimeEnv)) {
      vi.stubEnv(key, `wired:${key}`);
    }
    // 跳过 createEnv 校验，让唯一标记值原样留在 runtimeEnv 里。
    vi.stubEnv("SKIP_ENV_VALIDATION", "true");
    vi.resetModules();

    const fresh =
      await vi.importActual<typeof import("@/lib/env")>("@/lib/env");
    const miswired = Object.entries(fresh.runtimeEnv)
      .filter(([key]) => key !== "SKIP_ENV_VALIDATION")
      .filter(([key, value]) => value !== `wired:${key}`)
      .map(([key]) => key);

    expect(miswired).toEqual([]);
    expect(fresh.runtimeEnv.SKIP_ENV_VALIDATION).toBe("true");
  });

  it("keeps env example aligned with the central runtime env contract", () => {
    const envExample = parseEnvExample(readRepoFile(ENV_EXAMPLE_PATH));
    const schemaKeys = new Set([
      ...Object.keys(serverEnvSchema),
      ...Object.keys(clientEnvSchema),
    ]);
    const runtimeKeys = new Set<string>(Object.keys(runtimeEnv));

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
    // Wrangler 与 CI 部署需要它，但它不是运行时 schema key，上面的对齐检查看不到。
    expect(envExample.has("CLOUDFLARE_ACCOUNT_ID")).toBe(true);
  });

  // public-runtime-env 的 allowlist 是客户端读 env 的唯一合法入口。它每多一个
  // key 就绕过一次中心 schema 的登记，这条漂移只有这里能看见。只守「allowlist
  // 的读取都有登记」这一个方向：反向（schema 每个 key 都要进 allowlist）不是
  // 已证明的契约，不做。
  it("keeps public runtime allowlist reads registered in the client env schema", () => {
    // allowlist 未导出且无法经 getPublicRuntimeEnvString 枚举，只能窄读这一处字面量。
    const allowlistKeys = extractObjectLiteralKeys(
      readRepoFile(PUBLIC_RUNTIME_ENV_SOURCE_PATH),
      "PUBLIC_RUNTIME_ENV_READERS",
    );
    const clientSchemaKeys = new Set(Object.keys(clientEnvSchema));

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

  // 密钥形状的 key 一旦以 NEXT_PUBLIC_ 开头就会被打进浏览器 bundle。
  it("keeps secret-shaped keys out of the public env surface", () => {
    const envExample = parseEnvExample(readRepoFile(ENV_EXAMPLE_PATH));
    const publicSensitiveKeys = new Set(
      [...envExample.keys(), ...Object.keys(clientEnvSchema)].filter(
        (key) =>
          key.startsWith("NEXT_PUBLIC_") && SENSITIVE_ENV_KEY_PATTERN.test(key),
      ),
    );

    expect(sortedStrings(publicSensitiveKeys)).toEqual([]);
  });
});
