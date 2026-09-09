import { globSync } from "node:fs";
import { cruise, type ICruiseResult } from "dependency-cruiser";
import { beforeAll, describe, expect, it } from "vitest";

const CLIENT_ENTRY = "src/components/forms/inquiry-form.tsx";
const CLIENT_FORBIDDEN =
  /(?:^|\/)zod(?:\/|$)|src\/lib\/env(?:\.|$)|public-trust|single-site(?:-|\.|$)|inquiry-form-static-fallback/u;
const INQUIRY_ROUTE = "src/app/api/inquiry/route.ts";
const EMAIL_ENTRIES = [
  "src/lib/resend-core.tsx",
  "src/lib/email/runtime-email-content.ts",
  "src/lib/email/resend-http-client.ts",
];
const DELIVERY_SINKS = [
  "src/lib/lead-pipeline/process-lead.ts",
  "src/lib/email/runtime-email-content.ts",
  "src/lib/airtable/service-internal/lead-records.ts",
];
const FORBIDDEN_PACKAGES =
  /^(?:react-email|@react-email\/[^/]+|prettier|resend)(?:\/|$)/u;
const FIXTURE_ROOT = "tests/architecture/fixtures/lead-write-graph-regression";
const routes = globSync("src/app/api/**/route.{ts,tsx}");
let modules: Map<string, ICruiseResult["modules"][number]>;

beforeAll(async () => {
  const result = await cruise(
    [...routes, ...EMAIL_ENTRIES, CLIENT_ENTRY, FIXTURE_ROOT],
    {
      tsConfig: { fileName: "tsconfig.json" },
      tsPreCompilationDeps: false,
      doNotFollow: { path: "node_modules" },
      outputType: "json",
    },
  );
  const graph: ICruiseResult =
    typeof result.output === "string"
      ? JSON.parse(result.output)
      : result.output;
  modules = new Map(graph.modules.map((entry) => [entry.source, entry]));
});

// ponytail: literal import graph only; computed paths need separate runtime proof.
function reachable(entrypoints: string[]): Set<string> {
  const pending = [...entrypoints];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const entry = modules.get(current);
    expect(entry, `unresolved graph entry: ${current}`).toBeDefined();
    for (const dependency of entry!.dependencies) {
      if (
        dependency.module.startsWith("@/") ||
        dependency.module.startsWith(".")
      ) {
        expect(dependency.couldNotResolve, dependency.module).toBe(false);
      }
      pending.push(dependency.resolved);
    }
  }
  return visited;
}

describe("runtime dependency boundaries", () => {
  it("keeps inquiry as the only API route reaching lead delivery", () => {
    const writers = routes.filter((route) => {
      const graph = reachable([route]);
      return DELIVERY_SINKS.some((sink) => graph.has(sink));
    });
    expect(writers).toEqual([INQUIRY_ROUTE]);
    const graph = reachable([INQUIRY_ROUTE]);
    for (const target of [
      "src/lib/lead-pipeline/lead-schema.ts",
      ...DELIVERY_SINKS,
    ]) {
      expect(graph.has(target), target).toBe(true);
    }
  });

  it("keeps server-only and schema dependencies out of the transitive form graph", () => {
    expect(
      [...reachable([CLIENT_ENTRY])].filter((file) =>
        CLIENT_FORBIDDEN.test(file),
      ),
    ).toEqual([]);
  });

  it("keeps renderer packages out of the transitive email runtime graph", () => {
    const graph = reachable(EMAIL_ENTRIES);
    const forbidden = [...graph].flatMap((file) =>
      modules
        .get(file)!
        .dependencies.filter((dependency) =>
          FORBIDDEN_PACKAGES.test(dependency.module),
        ),
    );
    expect(forbidden).toEqual([]);
  });

  it("follows re-exports and dynamic imports but not type-only imports", () => {
    for (const fixture of [
      "route-via-facade.ts",
      "route-via-dynamic-import.ts",
    ]) {
      expect(
        reachable([`${FIXTURE_ROOT}/${fixture}`]).has(DELIVERY_SINKS[0]!),
      ).toBe(true);
    }
    expect(
      reachable([`${FIXTURE_ROOT}/route-via-types.ts`]).has(DELIVERY_SINKS[0]!),
    ).toBe(false);
  });

  it("detects a forbidden package behind a facade and dynamic import", () => {
    const graph = reachable([`${FIXTURE_ROOT}/email-via-facade.ts`]);
    expect([...graph].some((file) => CLIENT_FORBIDDEN.test(file))).toBe(true);
    expect(
      [...graph].some((file) =>
        modules
          .get(file)!
          .dependencies.some((dependency) =>
            FORBIDDEN_PACKAGES.test(dependency.module),
          ),
      ),
    ).toBe(true);
  });
});
