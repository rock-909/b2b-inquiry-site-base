import { afterEach, describe, expect, it } from "vitest";
import {
  VALID_BUTTON_REGISTRY_ITEM,
  baseFiles,
  createFixture,
  expectFinding,
  moveFixtureToTrash,
  registry,
} from "./component-governance-check.helpers";

const {
  collectComponentGovernanceFindings,
} = require("../../../scripts/quality/checks/component-governance.js");

describe("component-governance-check", () => {
  const fixtureRoots: string[] = [];

  afterEach(() => {
    for (const rootDir of fixtureRoots.splice(0)) {
      moveFixtureToTrash(rootDir);
    }
  });

  it("passes valid primitive registry without warning on business components that lack stories", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/components/products/product-card.tsx":
          "export function ProductCard() { return null; }",
        "src/components/sections/hero-section.tsx":
          "export function HeroSection() { return null; }",
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("does not warn for component folders outside the phase one story backlog", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/components/layout/header.tsx":
          "export function Header() { return null; }",
        "src/components/content/about-page-shell.tsx":
          "export function AboutPageShell() { return null; }",
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("fails when the component governance registry is missing", () => {
    const rootDir = createFixture({
      "src/components/ui/button.tsx":
        "export function Button() { return null; }",
    });
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "registry-missing",
      "src/components/component-governance.registry.json",
    );
  });

  it("fails when a UI primitive is missing from the registry", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/components/ui/input.tsx":
          "export function Input() { return null; }",
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(result.errors, "ui-primitive-missing-from-registry");
  });

  it("fails when the registry lists a nonexistent primitive", () => {
    const rootDir = createFixture({
      "src/components/component-governance.registry.json": registry({
        ghost: { story: "required" },
      }),
      "src/components/ui/button.tsx":
        "export function Button() { return null; }",
    });
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(result.errors, "registry-primitive-missing-source");
  });

  it("fails when a registry item does not define the story property", () => {
    const rootDir = createFixture({
      "src/components/component-governance.registry.json": registry({
        button: {},
      }),
      "src/components/ui/button.tsx":
        "export function Button() { return null; }",
    });
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(result.errors, "registry-story-missing");
  });

  it("fails when a registry item uses a story value other than required", () => {
    const rootDir = createFixture({
      "src/components/component-governance.registry.json": registry({
        button: { story: "optional" },
      }),
      "src/components/ui/button.tsx":
        "export function Button() { return null; }",
      "src/components/ui/button.stories.tsx":
        "export default { title: 'UI/Button' };",
    });
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(result.errors, "registry-story-invalid");
  });

  it("fails when a registry item is missing source-truth metadata", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/components/component-governance.registry.json": registry({
          button: {
            story: "required",
            radixLayer: "primitive",
          },
        }),
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(result.errors, "registry-source-field-missing");
  });

  it("fails when a registry item uses invalid source-truth metadata", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/components/component-governance.registry.json": registry({
          button: {
            story: "required",
            radixLayer: "vendor",
            clientBoundary: "server-safe",
          },
        }),
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(result.errors, "registry-source-field-invalid");
  });

  it("passes when a registry item includes valid source-truth metadata", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/components/component-governance.registry.json": registry({
          button: VALID_BUTTON_REGISTRY_ITEM,
        }),
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
  });

  it("fails when registry clientBoundary drifts from wrapper source", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/components/component-governance.registry.json": registry({
          button: {
            ...VALID_BUTTON_REGISTRY_ITEM,
            clientBoundary: "server-safe",
          },
        }),
        "src/components/ui/button.tsx":
          '"use client";\nimport { Slot } from "@radix-ui/react-slot";\nexport function Button() { return <Slot />; }',
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(result.errors, "registry-source-mismatch");
  });

  it("fails when registry radixLayer drifts from wrapper source", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/components/component-governance.registry.json": registry({
          button: {
            ...VALID_BUTTON_REGISTRY_ITEM,
            radixLayer: "local",
          },
        }),
        "src/components/ui/button.tsx":
          'import { Slot } from "@radix-ui/react-slot";\nexport function Button() { return <Slot />; }',
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(result.errors, "registry-source-mismatch");
  });

  it("fails when a required primitive story file is missing", () => {
    const rootDir = createFixture({
      "src/components/component-governance.registry.json": registry({
        button: { story: "required" },
      }),
      "src/components/ui/button.tsx":
        "export function Button() { return null; }",
    });
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "required-story-missing",
      "src/components/ui/button.stories.tsx",
    );
  });

  it("fails when production UI code outside src/components/ui imports Radix directly", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/components/layout/header.tsx":
          'import { Slot } from "@radix-ui/react-slot";\nexport function Header() { return null; }',
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "radix-import-outside-ui",
      "src/components/layout/header.tsx",
    );
  });

  it("detects multiline Radix imports and keeps wrapper source truth accurate", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/components/component-governance.registry.json": registry({
          button: {
            ...VALID_BUTTON_REGISTRY_ITEM,
            radixLayer: "local",
          },
        }),
        "src/components/ui/button.tsx":
          'import {\n  Slot,\n} from "@radix-ui/react-slot";\nexport function Button() { return <Slot />; }',
        "src/components/layout/header.tsx":
          'export {\n  Slot as HeaderSlot,\n} from "@radix-ui/react-slot";',
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(result.errors, "registry-source-mismatch");
    expectFinding(
      result.errors,
      "radix-import-outside-ui",
      "src/components/layout/header.tsx",
    );
  });

  it("scans Radix module references across all production source directories", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/lib/label.ts":
          'import {\n  Root as Label,\n} from "@radix-ui/react-label";\nexport { Label };',
        "src/lib/dialog-loader.ts":
          'export async function loadDialog() { return import("@radix-ui/react-dialog"); }',
        "src/lib/menu-loader.ts":
          'const menu = require("@radix-ui/react-dropdown-menu");\nexport { menu };',
        "src/lib/slot-export.ts":
          'export { Slot } from "@radix-ui/react-slot";',
        "src/lib/themes-side-effect.ts":
          'import "@radix-ui/themes/styles.css";\nexport const loaded = true;',
        "src/config/theme-loader.ts":
          'const themes = require("@radix-ui/themes");\nexport { themes };',
        "src/i18n/slot-export.ts":
          'export { Slot } from "@radix-ui/react-slot";',
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    for (const file of [
      "src/lib/label.ts",
      "src/lib/dialog-loader.ts",
      "src/lib/menu-loader.ts",
      "src/lib/slot-export.ts",
    ]) {
      expectFinding(result.errors, "radix-import-outside-ui", file);
    }
    expectFinding(
      result.errors,
      "radix-themes-import-forbidden",
      "src/lib/themes-side-effect.ts",
    );
    expectFinding(
      result.errors,
      "radix-themes-import-forbidden",
      "src/config/theme-loader.ts",
    );
    expectFinding(
      result.errors,
      "radix-import-outside-ui",
      "src/i18n/slot-export.ts",
    );
  });

  it("does not treat comments or ordinary strings as Radix module references", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/lib/radix-notes.ts": [
          '// import { Slot } from "@radix-ui/react-slot";',
          'const example = `import("@radix-ui/themes")`;',
          "export { example };",
        ].join("\n"),
        "src/app/radix-notes.css": [
          '/* @import "@radix-ui/themes/styles.css"; */',
          '.example::before { content: "@import url(@radix-ui/themes/styles.css)"; }',
        ].join("\n"),
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
  });

  it("allows direct Radix imports inside src/components/ui", () => {
    const rootDir = createFixture({
      "src/components/component-governance.registry.json": registry({
        button: VALID_BUTTON_REGISTRY_ITEM,
      }),
      "src/components/ui/button.tsx":
        'import { Slot } from "@radix-ui/react-slot";\nexport function Button() { return <Slot />; }',
      "src/components/ui/button.stories.tsx":
        "export default { title: 'UI/Button' };",
    });
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
  });

  it("fails when the retired Radix Themes package is imported in business code", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/components/forms/contact-form.tsx":
          'import { TextField } from "@radix-ui/themes";\nexport function ContactForm() { return <TextField.Root />; }',
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "radix-themes-import-forbidden",
      "src/components/forms/contact-form.tsx",
    );
  });

  it("fails when the retired Radix Themes package is dynamically loaded", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/components/forms/contact-form.tsx":
          'export async function loadContactFormUi() { return import("@radix-ui/themes"); }',
        "src/components/contact/contact-card.tsx":
          'const themes = require("@radix-ui/themes");\nexport function ContactCard() { return themes; }',
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "radix-themes-import-forbidden",
      "src/components/forms/contact-form.tsx",
    );
    expectFinding(
      result.errors,
      "radix-themes-import-forbidden",
      "src/components/contact/contact-card.tsx",
    );
  });

  it("detects statically known Radix imports behind TypeScript expression wrappers", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/lib/parenthesized-import.ts":
          'export async function loadTheme() { return import(("@radix-ui/themes")); }',
        "src/lib/asserted-import.ts":
          'export async function loadTheme() { return import("@radix-ui/themes" as string); }',
        "src/lib/satisfies-import.ts":
          'export async function loadTheme() { return import("@radix-ui/themes" satisfies string); }',
        "src/lib/type-asserted-import.ts":
          'export async function loadTheme() { return import(<string>"@radix-ui/themes"); }',
        "src/lib/parenthesized-require.ts":
          'const theme = require(("@radix-ui/themes"));\nexport { theme };',
        "src/lib/asserted-require.ts":
          'const theme = require("@radix-ui/themes" as string);\nexport { theme };',
        "src/lib/non-null-require.ts":
          'const theme = require(("@radix-ui/themes")!);\nexport { theme };',
        "src/lib/parenthesized-require-target.ts":
          'const theme = (require)("@radix-ui/themes");\nexport { theme };',
        "src/lib/asserted-require-target.ts":
          'const theme = (require as NodeRequire)("@radix-ui/themes");\nexport { theme };',
        "src/lib/type-asserted-require-target.ts":
          'const theme = (<NodeRequire>require)("@radix-ui/themes");\nexport { theme };',
        "src/lib/satisfies-require-target.ts":
          'const theme = (require satisfies NodeRequire)("@radix-ui/themes");\nexport { theme };',
        "src/lib/non-null-require-target.ts":
          'const theme = require!("@radix-ui/themes");\nexport { theme };',
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    for (const file of [
      "src/lib/parenthesized-import.ts",
      "src/lib/asserted-import.ts",
      "src/lib/satisfies-import.ts",
      "src/lib/type-asserted-import.ts",
      "src/lib/parenthesized-require.ts",
      "src/lib/asserted-require.ts",
      "src/lib/non-null-require.ts",
      "src/lib/parenthesized-require-target.ts",
      "src/lib/asserted-require-target.ts",
      "src/lib/type-asserted-require-target.ts",
      "src/lib/satisfies-require-target.ts",
      "src/lib/non-null-require-target.ts",
    ]) {
      expectFinding(result.errors, "radix-themes-import-forbidden", file);
    }
  });

  it("fails when Radix packages use side-effect, re-export, or CommonJS imports outside UI wrappers", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/components/forms/contact-form.tsx":
          'import "@radix-ui/themes/styles.css";\nexport function ContactForm() { return null; }',
        "src/components/layout/dialog-loader.tsx":
          'export async function loadDialog() { return import("@radix-ui/react-dialog"); }',
        "src/components/layout/menu-loader.tsx":
          'const menu = require("@radix-ui/react-dropdown-menu");\nexport { menu };',
        "src/components/layout/slot-export.tsx":
          'export { Slot } from "@radix-ui/react-slot";',
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "radix-themes-import-forbidden",
      "src/components/forms/contact-form.tsx",
    );
    for (const file of [
      "src/components/layout/dialog-loader.tsx",
      "src/components/layout/menu-loader.tsx",
      "src/components/layout/slot-export.tsx",
    ]) {
      expectFinding(result.errors, "radix-import-outside-ui", file);
    }
  });

  it("fails when a production stylesheet imports the retired Radix Themes CSS", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/app/globals.css": '@import url("@radix-ui/themes/styles.css");\n',
        "src/app/vendor.css": "@import url(@radix-ui/themes/styles.css);\n",
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "radix-themes-import-forbidden",
      "src/app/globals.css",
    );
    expectFinding(
      result.errors,
      "radix-themes-import-forbidden",
      "src/app/vendor.css",
    );
  });

  it("classifies dynamically imported Radix Primitives in UI wrappers", () => {
    const rootDir = createFixture({
      "src/components/component-governance.registry.json": registry({
        dialog: {
          story: "required",
          radixLayer: "primitive",
          clientBoundary: "server-safe",
        },
      }),
      "src/components/ui/dialog.tsx":
        'export async function loadDialog() { return import("@radix-ui/react-dialog"); }',
      "src/components/ui/dialog.stories.tsx":
        "export default { title: 'UI/Dialog' };",
    });
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
  });

  it("fails when the retired Radix Themes package is imported in a UI wrapper", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/components/ui/input.tsx":
          'import { TextField } from "@radix-ui/themes";\nexport function Input() { return <TextField.Root />; }',
        "src/components/ui/input.stories.tsx":
          "export default { title: 'UI/Input' };",
        "src/components/component-governance.registry.json": registry({
          button: VALID_BUTTON_REGISTRY_ITEM,
          input: {
            story: "required",
            radixLayer: "local",
            clientBoundary: "server-safe",
          },
        }),
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "radix-themes-import-forbidden",
      "src/components/ui/input.tsx",
    );
  });

  it("finds Radix Themes after another Radix reference in the same UI wrapper", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/components/ui/button.tsx": [
          'import { Slot } from "@radix-ui/react-slot";',
          'import { Theme } from "@radix-ui/themes";',
          "export function Button() { return <Theme><Slot /></Theme>; }",
        ].join("\n"),
        "src/components/ui/vendor.css": [
          '@import "@radix-ui/colors/blue.css";',
          '@import "@radix-ui/themes/styles.css";',
        ].join("\n"),
        "src/components/ui/vendor-same-line.css":
          '@import "@radix-ui/colors/blue.css"; @import "@radix-ui/themes/styles.css";',
        "src/components/ui/vendor-uppercase.css":
          '@IMPORT URL("@radix-ui/themes/styles.css");',
        "src/components/ui/vendor-no-space.css": [
          '@import"@radix-ui/themes/styles.css";',
          "@IMPORT'@radix-ui/themes/styles.css';",
        ].join("\n"),
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "radix-themes-import-forbidden",
      "src/components/ui/button.tsx",
    );
    expectFinding(
      result.errors,
      "radix-themes-import-forbidden",
      "src/components/ui/vendor.css",
    );
    expectFinding(
      result.errors,
      "radix-themes-import-forbidden",
      "src/components/ui/vendor-same-line.css",
    );
    expectFinding(
      result.errors,
      "radix-themes-import-forbidden",
      "src/components/ui/vendor-uppercase.css",
    );
    expectFinding(
      result.errors,
      "radix-themes-import-forbidden",
      "src/components/ui/vendor-no-space.css",
    );
  });

  it("fails when Radix Themes subpath imports are used", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/components/forms/contact-form.tsx":
          'export async function loadContactFormUi() { return import("@radix-ui/themes/components/text-field"); }',
        "src/components/contact/contact-card.tsx":
          'const themes = require("@radix-ui/themes/components/card");\nexport function ContactCard() { return themes; }',
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "radix-themes-import-forbidden",
      "src/components/forms/contact-form.tsx",
    );
    expectFinding(
      result.errors,
      "radix-themes-import-forbidden",
      "src/components/contact/contact-card.tsx",
    );
  });

  it("fails when production UI code styles Radix Themes internal classes", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/components/ui/button.tsx":
          'export function Button() { return <button className="rt-Button" />; }',
        "src/components/sections/hero-section.tsx":
          'export function HeroSection() { return <div className="[&_.rt-Card]:p-4" />; }',
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "radix-themes-internal-class",
      "src/components/ui/button.tsx",
    );
    expectFinding(
      result.errors,
      "radix-themes-internal-class",
      "src/components/sections/hero-section.tsx",
    );
  });

  it("fails on obvious raw Tailwind palette classes in production files", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/app/[locale]/page.tsx":
          'export default function Page() { return <div className="bg-blue-500 text-white" />; }',
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "raw-tailwind-palette-class",
      "src/app/[locale]/page.tsx",
    );
  });

  it("ignores raw Tailwind palette classes in story and test files", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/components/products/product-card.stories.tsx":
          'export const Default = () => <div className="bg-blue-500" />;',
        "src/components/products/product-card.test.tsx":
          'it("uses palette classes", () => "bg-blue-500");',
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
  });

  it("fails when browser UI imports static theme colors by static, dynamic, or require path", () => {
    const rootDir = createFixture(
      baseFiles({
        "src/components/theme/theme-switcher.tsx":
          'import { colors } from "@/config/static-theme-colors";\nexport function ThemeSwitcher() { return null; }',
        "src/app/[locale]/theme/page.tsx":
          'import { colors } from "../../../config/static-theme-colors";\nexport default function Page() { return null; }',
        "src/components/footer/footer-colors.tsx":
          'export async function loadColors() { return import("@/config/static-theme-colors"); }',
        "src/components/contact/contact-colors.tsx":
          'const colors = require("../../config/static-theme-colors");\nexport function ContactColors() { return colors.primary; }',
      }),
    );
    fixtureRoots.push(rootDir);

    const result = collectComponentGovernanceFindings(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "static-theme-colors-browser-import",
      "src/components/theme/theme-switcher.tsx",
    );
    expectFinding(
      result.errors,
      "static-theme-colors-browser-import",
      "src/app/[locale]/theme/page.tsx",
    );
    expectFinding(
      result.errors,
      "static-theme-colors-browser-import",
      "src/components/footer/footer-colors.tsx",
    );
    expectFinding(
      result.errors,
      "static-theme-colors-browser-import",
      "src/components/contact/contact-colors.tsx",
    );
  });
});
