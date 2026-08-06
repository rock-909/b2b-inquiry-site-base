import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const EMAIL_RUNTIME_ENTRYPOINTS = [
  "src/lib/resend-instance.ts",
  "src/lib/resend-core.tsx",
  "src/lib/email/runtime-email-content.ts",
  "src/lib/email/resend-http-client.ts",
] as const;

const FORBIDDEN_RUNTIME_PACKAGES = [
  "react-email",
  "@react-email/render",
  "@react-email/ui",
  "prettier",
  "resend",
] as const;

const ALLOWED_EMAILS_RUNTIME_FILES = new Set([
  "src/emails/email-copy.ts",
  "src/emails/theme.ts",
]);

function expectNoRuntimeRendererImports(source: string): void {
  expect(source).not.toContain("react-email");
  expect(source).not.toContain("@react-email/render");
  expect(source).not.toContain("@react-email/ui");
  expect(source).not.toContain("prettier");
  expect(source).not.toContain('from "resend"');
}

function toRepoPath(filePath: string): string {
  return normalize(filePath).replaceAll("\\", "/");
}

function resolveRuntimeImport(
  fromFile: string,
  specifier: string,
): string | null {
  if (specifier.startsWith("@/")) {
    return resolveExistingSourceFile(join("src", specifier.slice(2)));
  }

  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    return resolveExistingSourceFile(join(dirname(fromFile), specifier));
  }

  return null;
}

function resolveExistingSourceFile(candidate: string): string | null {
  const normalizedCandidate = toRepoPath(candidate);
  const candidates = extname(normalizedCandidate)
    ? [normalizedCandidate]
    : [
        `${normalizedCandidate}.ts`,
        `${normalizedCandidate}.tsx`,
        join(normalizedCandidate, "index.ts"),
        join(normalizedCandidate, "index.tsx"),
      ].map(toRepoPath);

  for (const candidatePath of candidates) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test resolves imports from fixed email runtime entrypoints
    if (existsSync(candidatePath)) return candidatePath;
  }

  return null;
}

function readRuntimeSource(filePath: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads files discovered from fixed email runtime entrypoints
  return readFileSync(filePath, "utf8");
}

function collectImportSpecifiers(filePath: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const specifiers: string[] = [];

  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      specifiers.push(statement.moduleSpecifier.text);
    }
  }

  return specifiers;
}

function collectRuntimeDependencyGraph(
  entrypoints: readonly string[],
): Set<string> {
  const pending = [...entrypoints];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;

    visited.add(current);
    const source = readRuntimeSource(current);

    for (const specifier of collectImportSpecifiers(current, source)) {
      const resolved = resolveRuntimeImport(current, specifier);
      if (resolved && !visited.has(resolved)) {
        pending.push(resolved);
      }
    }
  }

  return visited;
}

describe("runtime email boundary", () => {
  it("keeps React Email rendering out of ResendService runtime", () => {
    const source = readFileSync("src/lib/resend-core.tsx", "utf8");

    expectNoRuntimeRendererImports(source);
    expect(source).not.toContain("render(");
    expect(source).not.toContain("react:");
    expect(source).toContain("html:");
    expect(source).toContain("text:");
  });

  it("keeps the lightweight runtime email builder renderer-free", () => {
    const source = readFileSync(
      "src/lib/email/runtime-email-content.ts",
      "utf8",
    );
    const httpClientSource = readFileSync(
      "src/lib/email/resend-http-client.ts",
      "utf8",
    );

    expectNoRuntimeRendererImports(source);
    expectNoRuntimeRendererImports(httpClientSource);
    expect(source).toContain("buildProductInquiryEmailContent");
    expect(source).not.toContain("buildContactFormEmailContent");
    expect(source).not.toContain("buildConfirmationEmailContent");
  });

  it("keeps forbidden renderer and SDK packages out of the email runtime graph", () => {
    const dependencyGraph = collectRuntimeDependencyGraph(
      EMAIL_RUNTIME_ENTRYPOINTS,
    );
    const graphSources = [...dependencyGraph]
      .map((file) => readRuntimeSource(file))
      .join("\n");

    for (const packageName of FORBIDDEN_RUNTIME_PACKAGES) {
      expect(graphSources).not.toContain(`from "${packageName}"`);
      expect(graphSources).not.toContain(`from '${packageName}'`);
    }

    const emailFiles = [...dependencyGraph].filter((file) =>
      file.startsWith("src/emails/"),
    );
    expect(emailFiles.sort()).toEqual([...ALLOWED_EMAILS_RUNTIME_FILES].sort());
  });
});
