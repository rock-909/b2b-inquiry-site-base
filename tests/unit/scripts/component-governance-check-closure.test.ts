import { afterEach, describe, expect, it } from "vitest";
import {
  baseFiles,
  createFixture,
  expectFinding,
  moveFixtureToTrash,
} from "./component-governance-check.helpers";

const {
  collectComponentGovernanceFindings,
} = require("../../../scripts/quality/checks/component-governance.js");
const {
  getRadixModuleReferenceSummary,
} = require("../../../scripts/component-governance-registry-truth.js");

describe("component-governance-check C1 closure gaps", () => {
  const fixtureRoots: string[] = [];

  afterEach(() => {
    for (const rootDir of fixtureRoots.splice(0)) {
      moveFixtureToTrash(rootDir);
    }
  });

  it("detects module.require CommonJS property-access forms", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/lib/module-require.ts":
          'const theme = module.require("@radix-ui/themes");\nexport { theme };',
        "src/lib/module-require-wrapped.ts":
          'const theme = (module as NodeModule).require("@radix-ui/themes");\nexport { theme };',
        "src/lib/module-element-require.ts":
          'const theme = module["require"]("@radix-ui/themes");\nexport { theme };',
        "src/components/layout/module-require-dialog.tsx":
          'const dialog = module.require("@radix-ui/react-dialog");\nexport { dialog };',
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    for (const file of [
      "src/lib/module-require.ts",
      "src/lib/module-require-wrapped.ts",
      "src/lib/module-element-require.ts",
    ]) {
      expectFinding(result.errors, "radix-themes-import-forbidden", file);
    }
    expectFinding(
      result.errors,
      "radix-import-outside-ui",
      "src/components/layout/module-require-dialog.tsx",
    );
  });

  it("fails on Radix Themes internal classes outside app and components trees", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/config/ui-class-truth.ts":
          'export const cardClass = "rt-Card rt-r-size-2";\n',
        "src/lib/ui-class-helpers.ts":
          'export const dialClass = "rt-BaseButton";\n',
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "radix-themes-internal-class",
      "src/config/ui-class-truth.ts",
    );
    expectFinding(
      result.errors,
      "radix-themes-internal-class",
      "src/lib/ui-class-helpers.ts",
    );
  });

  it("scans production MDX and static @radix-ui call arguments", () => {
    const rootDir = createFixture(
      baseFiles({
        "content/pages/en/radix-themes.mdx": [
          'import { Card } from "@radix-ui/themes";',
          "",
          '<section className="rt-Card"><Card /></section>',
        ].join("\n"),
        "src/lib/create-require-theme.ts": [
          'import { createRequire } from "node:module";',
          "const load = createRequire(import.meta.url);",
          'const theme = load("@radix-ui/themes");',
          "export { theme };",
        ].join("\n"),
        "src/lib/create-require-alias-theme.ts": [
          'import { createRequire as makeRequire } from "node:module";',
          "const load = makeRequire(import.meta.url);",
          'const theme = load("@radix-ui/themes");',
          "export { theme };",
        ].join("\n"),
        "src/lib/create-require-namespace-theme.ts": [
          'import * as nodeModule from "node:module";',
          "const load = nodeModule.createRequire(import.meta.url);",
          'const theme = load("@radix-ui/themes");',
          "export { theme };",
        ].join("\n"),
        "src/lib/create-require-direct-theme.ts": [
          'import { createRequire } from "node:module";',
          'const theme = createRequire(import.meta.url)("@radix-ui/themes");',
          "export { theme };",
        ].join("\n"),
        "src/lib/require-alias-dialog.ts": [
          "const load = require;",
          "const again = load;",
          'const dialog = again("@radix-ui/react-dialog");',
          "export { dialog };",
        ].join("\n"),
        "src/lib/require-alias-call-theme.ts": [
          "const load = require;",
          'const theme = load.call(null, "@radix-ui/themes");',
          "export { theme };",
        ].join("\n"),
        "src/lib/require-call-theme.ts":
          'const theme = require.call(null, "@radix-ui/themes");\nexport { theme };',
        "src/lib/module-require-call-dialog.ts":
          'const dialog = module.require.call(module, "@radix-ui/react-dialog");\nexport { dialog };',
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "radix-themes-import-forbidden",
      "content/pages/en/radix-themes.mdx",
    );
    expectFinding(
      result.errors,
      "radix-themes-internal-class",
      "content/pages/en/radix-themes.mdx",
    );
    for (const file of [
      "src/lib/create-require-theme.ts",
      "src/lib/create-require-alias-theme.ts",
      "src/lib/create-require-namespace-theme.ts",
      "src/lib/create-require-direct-theme.ts",
      "src/lib/require-alias-call-theme.ts",
      "src/lib/require-call-theme.ts",
    ]) {
      expectFinding(result.errors, "radix-themes-import-forbidden", file);
    }
    for (const file of [
      "src/lib/require-alias-dialog.ts",
      "src/lib/module-require-call-dialog.ts",
    ]) {
      expectFinding(result.errors, "radix-import-outside-ui", file);
    }
  });

  it("treats static @radix-ui call args as package references", () => {
    const cases = [
      'import { createRequire as makeRequire } from "node:module";\nconst load = makeRequire(import.meta.url);\nload("@radix-ui/themes");',
      'import * as nodeModule from "node:module";\nconst load = nodeModule.createRequire(import.meta.url);\nload("@radix-ui/themes");',
      'const load = require;\nconst again = load;\nagain("@radix-ui/themes");',
      'const load = require;\nload.call(null, "@radix-ui/themes");',
      'import { createRequire } from "node:module";\ncreateRequire(import.meta.url)("@radix-ui/themes");',
    ];

    for (const source of cases) {
      expect(
        getRadixModuleReferenceSummary(source).themesReference,
      ).not.toBeNull();
    }
  });
});
