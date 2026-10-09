import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import {
  getPublicRuntimeEnvString,
  type PublicRuntimeEnvKey,
} from "@/lib/public-runtime-env";

const FORBIDDEN_SERVER_ENV_KEYS = [
  "RESEND_API_KEY",
  "AIRTABLE_API_KEY",
  "TURNSTILE_SECRET_KEY",
  "RATE_LIMIT_PEPPER",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

function read(repoPath: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 测试只读取固定仓库文件或下方 src 扫描结果
  return readFileSync(repoPath, "utf8");
}

function sourceFiles(dir: string, results: string[] = []): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 扫描范围固定为仓库 src
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(entryPath, results);
    } else if (
      entry.isFile() &&
      [".ts", ".tsx"].includes(extname(entry.name))
    ) {
      results.push(relative(process.cwd(), entryPath).split(sep).join("/"));
    }
  }
  return results;
}

function isClientComponent(source: string): boolean {
  const sourceFile = ts.createSourceFile(
    "client-boundary.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const [firstStatement] = sourceFile.statements;

  return Boolean(
    firstStatement &&
    ts.isExpressionStatement(firstStatement) &&
    ts.isStringLiteral(firstStatement.expression) &&
    firstStatement.expression.text === "use client",
  );
}

function referencesServerEnvFacade(source: string): boolean {
  const sourceFile = ts.createSourceFile(
    "env-boundary.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let found = false;

  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text.startsWith("@/lib/env")
    ) {
      found = true;
      return;
    }

    if (ts.isCallExpression(node)) {
      const [firstArgument] = node.arguments;
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        firstArgument &&
        ts.isStringLiteral(firstArgument) &&
        firstArgument.text.startsWith("@/lib/env")
      ) {
        found = true;
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

describe("env module boundaries", () => {
  it.each([...FORBIDDEN_SERVER_ENV_KEYS, "NEXT_PUBLIC_CSP_NONCE"])(
    "rejects %s at the public runtime boundary",
    (key) => {
      expect(() =>
        getPublicRuntimeEnvString(key as PublicRuntimeEnvKey),
      ).toThrow("not on the public runtime allowlist");
    },
  );

  it('keeps "use client" files off server env and PII helpers', () => {
    const offenders = sourceFiles("src").filter((repoPath) => {
      const source = read(repoPath);

      return (
        isClientComponent(source) &&
        (referencesServerEnvFacade(source) ||
          /\b(?:sanitizeEmail|sanitizeIP)\b/u.test(source))
      );
    });

    expect(offenders).toEqual([]);
  });

  it.each([
    '// component\n"use client";\nimport { env } from "@/lib/env";',
    '"use client";\nconst env = await import("@/lib/env");',
  ])("detects client imports of the server env facade", (source) => {
    expect(isClientComponent(source)).toBe(true);
    expect(referencesServerEnvFacade(source)).toBe(true);
  });
});
