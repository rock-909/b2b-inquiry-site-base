import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// Two gates ask the same question and must not answer differently.
// `component-governance` derives the registry's `clientBoundary` value from the
// wrapper source; `client-boundary` counts the same files against the committed
// budget. When they disagree, one gate demands a declaration the other rejects,
// and the branch cannot be made green. This test is what makes that fail.
const require = createRequire(import.meta.url);
const { getExpectedClientBoundary } =
  require("../../../scripts/component-governance-registry-truth.js") as {
    getExpectedClientBoundary: (source: string) => "client" | "server-safe";
  };
const { hasTopLevelUseClientDirective } =
  require("../../../scripts/quality/checks/client-boundary.js") as {
    hasTopLevelUseClientDirective: (source: string) => boolean;
  };

const CASES: ReadonlyArray<{
  name: string;
  source: string;
  expected: "client" | "server-safe";
}> = [
  {
    name: "directive on the first line",
    source: '"use client";\nexport const A = 1;\n',
    expected: "client",
  },
  {
    name: "directive after a leading comment",
    source: '// wrapper notes\n"use client";\nexport const A = 1;\n',
    expected: "client",
  },
  {
    name: "single-quoted directive",
    source: "'use client';\nexport const A = 1;\n",
    expected: "client",
  },
  {
    name: "no directive at all",
    source: 'import x from "y";\nexport const A = 1;\n',
    expected: "server-safe",
  },
  // Next.js only honours the directive prologue. A /m regex over the whole file
  // counted both of these as client boundaries; the AST reading does not.
  {
    name: "directive text inside a template literal",
    source: 'export const doc = `\n"use client";\n`;\nexport const A = 1;\n',
    expected: "server-safe",
  },
  {
    name: "directive written after an import",
    source: 'import x from "y";\n"use client";\nexport const A = 1;\n',
    expected: "server-safe",
  },
];

describe("use client detection parity between the governance and budget gates", () => {
  it.each(CASES)("agrees on: $name", ({ source, expected }) => {
    const governance = getExpectedClientBoundary(source);
    const budget = hasTopLevelUseClientDirective(source)
      ? "client"
      : "server-safe";

    expect(governance).toBe(expected);
    expect(budget).toBe(expected);
  });
});
