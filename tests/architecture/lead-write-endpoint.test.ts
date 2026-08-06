import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const INQUIRY_ROUTE = "src/app/api/inquiry/route.ts";
const REGRESSION_FACADE_ROUTE =
  "tests/architecture/fixtures/lead-write-graph-regression/route-via-facade.ts";
const REGRESSION_DYNAMIC_IMPORT_ROUTE =
  "tests/architecture/fixtures/lead-write-graph-regression/route-via-dynamic-import.ts";
const REGRESSION_NON_LITERAL_DYNAMIC_IMPORT_ROUTE =
  "tests/architecture/fixtures/lead-write-graph-regression/route-via-non-literal-dynamic-import.ts";

const LEAD_DELIVERY_SINKS = [
  "src/lib/lead-pipeline/process-lead.ts",
  "src/lib/email/runtime-email-content.ts",
  "src/lib/airtable/service-internal/lead-records.ts",
] as const;

const INQUIRY_REQUIRED_GRAPH_TARGETS = [
  "src/lib/lead-pipeline/lead-schema.ts",
  ...LEAD_DELIVERY_SINKS,
] as const;

function read(repoPath: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads fixed repo-local files.
  return readFileSync(repoPath, "utf8");
}

function toRepoPath(filePath: string): string {
  return normalize(filePath).replaceAll("\\", "/");
}

function createSourceFile(filePath: string, source: string): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function resolveImport(fromFile: string, specifier: string): string | null {
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
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test resolves imports from fixed entrypoints
    if (existsSync(candidatePath)) return candidatePath;
  }

  return null;
}

function collectImportSpecifiers(filePath: string, source: string): string[] {
  const sourceFile = createSourceFile(filePath, source);
  const specifiers: string[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const [argument] = node.arguments;

      if (
        node.arguments.length === 1 &&
        argument !== undefined &&
        ts.isStringLiteral(argument)
      ) {
        specifiers.push(argument.text);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return specifiers;
}

function collectDependencyGraph(entrypoint: string): Set<string> {
  const pending = [entrypoint];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;

    visited.add(current);
    const source = read(current);

    for (const specifier of collectImportSpecifiers(current, source)) {
      const resolved = resolveImport(current, specifier);
      if (resolved && !visited.has(resolved)) {
        pending.push(resolved);
      }
    }
  }

  return visited;
}

function graphReachesLeadDeliverySink(graph: Set<string>): boolean {
  return LEAD_DELIVERY_SINKS.some((sink) => graph.has(sink));
}

function listApiRouteFiles(directory = "src/app/api"): string[] {
  const routes: string[] = [];
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test walks fixed api route tree
  const entries = readdirSync(directory);

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test walks fixed api route tree
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      routes.push(...listApiRouteFiles(fullPath));
      continue;
    }

    if (entry === "route.ts" || entry === "route.tsx") {
      routes.push(toRepoPath(fullPath));
    }
  }

  return routes;
}

describe("lead write endpoint ownership", () => {
  it("keeps /api/inquiry as the only API route whose import graph reaches lead delivery sinks", () => {
    const routesReachingSinks: string[] = [];

    for (const routePath of listApiRouteFiles()) {
      const graph = collectDependencyGraph(routePath);
      if (graphReachesLeadDeliverySink(graph)) {
        routesReachingSinks.push(routePath);
      }
    }

    expect(routesReachingSinks).toEqual([INQUIRY_ROUTE]);
  });

  it("reaches schema, processor, owner email, and Airtable delivery from /api/inquiry", () => {
    const graph = collectDependencyGraph(INQUIRY_ROUTE);

    for (const target of INQUIRY_REQUIRED_GRAPH_TARGETS) {
      expect(graph.has(target), `missing ${target}`).toBe(true);
    }
  });

  it("detects facade/barrel lead delivery through the import graph", () => {
    const graph = collectDependencyGraph(REGRESSION_FACADE_ROUTE);

    expect(graphReachesLeadDeliverySink(graph)).toBe(true);
  });

  it("detects lead delivery through string-literal dynamic import", () => {
    const graph = collectDependencyGraph(REGRESSION_DYNAMIC_IMPORT_ROUTE);

    expect(graphReachesLeadDeliverySink(graph)).toBe(true);
  });

  it("does not invent paths from non-literal dynamic imports", () => {
    const graph = collectDependencyGraph(
      REGRESSION_NON_LITERAL_DYNAMIC_IMPORT_ROUTE,
    );

    expect(graphReachesLeadDeliverySink(graph)).toBe(false);
  });
});
