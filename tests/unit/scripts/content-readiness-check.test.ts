import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectContentReadinessFindings,
  collectReadinessScanFiles,
  runContentReadinessCheck,
} from "../../../scripts/quality/checks/content-readiness.js";

interface FindingShape {
  file: string;
  line: number;
  ruleId: string;
  severity: "error" | "warning";
  message: string;
}

const TEMP_TRASH_ROOT = path.join(
  os.tmpdir(),
  "showcase-content-readiness-test-trash",
);

function createFixture(files: Record<string, string>): string {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "showcase-content-readiness-"),
  );

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(rootDir, relativePath);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    fs.writeFileSync(fullPath, content, "utf8");
  }

  return rootDir;
}

function moveFixtureToTrash(rootDir: string): void {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- cleanup only checks the test-owned temporary fixture directory
  if (!fs.existsSync(rootDir)) return;

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- cleanup moves fixtures to a recoverable os.tmpdir trash folder
  fs.mkdirSync(TEMP_TRASH_ROOT, { recursive: true });
  const targetDir = path.join(
    TEMP_TRASH_ROOT,
    `${path.basename(rootDir)}-${Date.now()}`,
  );

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture cleanup uses recoverable rename instead of permanent deletion
  fs.renameSync(rootDir, targetDir);
}

function expectFinding(
  findings: FindingShape[],
  ruleId: string,
  file?: string,
): void {
  expect(findings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        ruleId,
        ...(file ? { file } : {}),
      }),
    ]),
  );
}

describe("content-readiness-check", () => {
  const fixtureRoots: string[] = [];

  afterEach(() => {
    for (const rootDir of fixtureRoots.splice(0)) {
      moveFixtureToTrash(rootDir);
    }
  });

  // 验证扫描实际触达的文件，不检查脚本源码中的路径文案。
  it("reaches the current Tucsenberg product-page files it claims to scan", () => {
    const scanned = collectReadinessScanFiles().map(
      (file: { repoPath: string }) => file.repoPath,
    );

    expect(scanned.length).toBeGreaterThan(0);
    expect(scanned).toContain("src/constants/tucsenberg-product-pages.ts");
    expect(
      scanned.filter((repoPath) =>
        repoPath.startsWith("src/constants/tucsenberg-product-page-"),
      ).length,
    ).toBeGreaterThan(0);

    for (const repoPath of scanned) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- paths come from the check's own repo-local scan targets
      expect(fs.existsSync(repoPath), repoPath).toBe(true);
    }
  });

  it("fails on hard fake buyer-visible content", () => {
    const rootDir = createFixture({
      "content/pages/en/about.mdx": "lorem ipsum\nCall +1 555-123-4567",
      "messages/profiles/b2b-lead/en/messages.json": JSON.stringify({
        cta: "Contact your company",
      }),
      "src/config/single-site-product-catalog.ts":
        "export const product = 'Sample Product';",
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(result.errors, "lorem-ipsum", "content/pages/en/about.mdx");
    expectFinding(result.errors, "fake-phone", "content/pages/en/about.mdx");
    expectFinding(
      result.warnings,
      "your-company",
      "messages/profiles/b2b-lead/en/messages.json",
    );
    expectFinding(
      result.warnings,
      "sample-product",
      "src/config/single-site-product-catalog.ts",
    );
  });

  it("warns on neutral starter placeholder wording without failing", () => {
    const rootDir = createFixture({
      "messages/profiles/b2b-lead/en/messages.json": JSON.stringify({
        form: {
          placeholder: "Enter your email address",
        },
      }),
      "content/pages/en/about.mdx":
        "Replace placeholder claims with evidence your real project can support.",
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
    expectFinding(result.warnings, "placeholder");
  });

  it("exempts form placeholder fields from generic-placeholder residue warnings", () => {
    const rootDir = createFixture({
      "messages/profiles/b2b-lead/en/messages.json": JSON.stringify({
        form: {
          emailPlaceholder: "your@email.com",
          companyPlaceholder: "Your company name",
        },
      }),
    });
    fixtureRoots.push(rootDir);

    // key 以 Placeholder 结尾的字段，其值本就是 UX 占位文案；
    // your-email / your-company 规则在这里被具名放行，不产生噪音 warning。
    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("does not treat JSON keys as buyer-visible residue", () => {
    const rootDir = createFixture({
      "messages/profiles/b2b-lead/en/messages.json": JSON.stringify({
        form: {
          placeholder: "Enter your email address",
          phonePlaceholder: "Phone number",
        },
      }),
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("does not treat config asset paths as buyer-visible product residue", () => {
    const rootDir = createFixture({
      "src/config/single-site-product-catalog.ts":
        "export const product = { image: '/images/products/sample-product.svg' };",
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("does not treat absolute config asset URLs as buyer-visible product residue", () => {
    const rootDir = createFixture({
      "src/config/single-site-product-catalog.ts":
        "export const product = { image: 'https://cdn.example.com/images/products/sample-product.svg' };",
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("does not treat commented config strings as buyer-visible product residue", () => {
    const rootDir = createFixture({
      "src/config/single-site.ts": [
        '// "Sample Product" belongs in documentation, not runtime config.',
        'export const profile = { companyName: "Real Company" };',
      ].join("\n"),
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("does not treat quoted config object keys as buyer-visible content", () => {
    const rootDir = createFixture({
      "src/config/single-site.ts":
        'export const profile = { "placeholder": "Real Company" };',
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("scans static template string values in config", () => {
    const rootDir = createFixture({
      "src/config/single-site.ts":
        "export const profile = { heroTitle: `Sample Product` };",
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expectFinding(
      result.warnings,
      "sample-product",
      "src/config/single-site.ts",
    );
  });

  it("scans current product-page and catalog config as buyer-visible truth", () => {
    const rootDir = createFixture({
      "src/constants/tucsenberg-product-page-test.ts": [
        "export const PRODUCT_PAGE = {",
        '  technical: { material: "Replaceable catalog example" },',
        '  certifications: ["Example Standard A"],',
        "};",
      ].join("\n"),
      "src/config/single-site-product-catalog.ts": [
        "export const singleSiteProductCatalog = {",
        '  markets: [{ label: "Primary Offer Example" }],',
        "};",
      ].join("\n"),
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expectFinding(
      result.warnings,
      "replaceable-content",
      "src/constants/tucsenberg-product-page-test.ts",
    );
    expectFinding(
      result.warnings,
      "example-standard",
      "src/constants/tucsenberg-product-page-test.ts",
    );
    expectFinding(
      result.warnings,
      "example-offer",
      "src/config/single-site-product-catalog.ts",
    );
  });

  it("allows legitimate replaceable product features", () => {
    const rootDir = createFixture({
      "src/constants/tucsenberg-product-page-test.ts":
        'export const seals = "EPDM seals, replaceable";',
    });
    fixtureRoots.push(rootDir);

    const findings = collectContentReadinessFindings(rootDir);

    expect(findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "replaceable-content" }),
      ]),
    );
  });

  it("does not treat commented logo asset references as runtime references", () => {
    const rootDir = createFixture({
      "src/config/single-site.ts": [
        "// docs note: replace /images/logo.svg later",
        'export const profile = { companyName: "Real Company" };',
      ].join("\n"),
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("does not treat config module paths as buyer-visible content", () => {
    const rootDir = createFixture({
      "src/config/single-site.ts": [
        'import placeholderKit from "@acme/placeholder-kit";',
        'export { sampleProductConfig } from "./sample-product-config";',
        'export const profile = { companyName: "Real Company" };',
        "void placeholderKit;",
      ].join("\n"),
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("does not treat TypeScript string literal types as buyer-visible content", () => {
    const rootDir = createFixture({
      "src/config/single-site.ts": [
        'export type ProductName = "Sample Product";',
        'export type LogoPath = "/images/logo.svg";',
        "export interface Profile {",
        '  category: "placeholder";',
        "}",
        'export const profile = { companyName: "Real Company" };',
      ].join("\n"),
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("scans TypeScript enum string values as runtime config content", () => {
    const rootDir = createFixture({
      "src/config/single-site.ts": [
        "export enum BrandText {",
        '  Title = "Sample Product",',
        '  Logo = "/images/logo.svg",',
        "}",
      ].join("\n"),
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expectFinding(
      result.warnings,
      "sample-product",
      "src/config/single-site.ts",
    );
    expect(result.errors).toEqual([]);
  });

  it("does not scan docs tests reports generated output or test files", () => {
    const rootDir = createFixture({
      "docs/example.md": "placeholder TODO Sample Product",
      "reports/deploy/result.json": "lorem ipsum",
      "generated/content.json": "your@email",
      "tests/unit/bad.test.ts": "const text = 'Replace this image';",
      "messages/__tests__/bad.json": JSON.stringify({
        text: "lorem ipsum",
      }),
      "content/pages/en/about.test.mdx": "placeholder",
      "content/pages/en/about.spec.mdx": "TODO",
      "public/images/ignored.md": "placeholder TODO Sample Product",
      "content/pages/en/about.mdx": "Real company content.",
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("reports example.com as a warning without failing the check", () => {
    const rootDir = createFixture({
      "src/config/single-site.ts":
        "export const website = { domain: 'https://example.com' };",
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
    expectFinding(
      result.warnings,
      "example-domain",
      "src/config/single-site.ts",
    );
  });

  it("warns on buyer-visible starter identity residue without failing the default starter check", () => {
    const rootDir = createFixture({
      "messages/profiles/b2b-lead/en/messages.json": JSON.stringify({
        title: "Showcase Website Starter",
      }),
      "content/pages/en/about.mdx": "Welcome to Public Demo Starter Site.",
      "src/config/single-site.ts":
        'export const site = { name: "Reusable Showcase Website Starter" };',
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
    expectFinding(result.warnings, "starter-identity");
  });

  it("promotes client-launch residue warnings to errors only in strict client launch mode", () => {
    const rootDir = createFixture({
      "messages/profiles/b2b-lead/en/messages.json": JSON.stringify({
        title: "Showcase Website Starter",
        product: "Sample Product",
        standard: "Example Standard A",
        email: "Send requests to your@email before launch.",
        phonePlaceholder: "+1-312-555-0198",
      }),
      "content/pages/en/about.mdx": "Visit https://example.com before launch.",
    });
    fixtureRoots.push(rootDir);

    const defaultResult = runContentReadinessCheck(rootDir);
    const strictResult = runContentReadinessCheck(rootDir, {
      strictClientLaunch: true,
    });

    expect(defaultResult.status).toBe("passed");
    expectFinding(defaultResult.warnings, "starter-identity");
    expectFinding(defaultResult.warnings, "fake-phone");

    expect(strictResult.status).toBe("failed");
    expectFinding(strictResult.errors, "starter-identity");
    expectFinding(strictResult.errors, "sample-product");
    expectFinding(strictResult.errors, "example-standard");
    expectFinding(strictResult.errors, "your-email");
    expectFinding(strictResult.errors, "fake-phone");
    expectFinding(strictResult.errors, "example-domain");
  });

  it("warns on example.com in buyer-visible page content", () => {
    const rootDir = createFixture({
      "content/pages/en/about.mdx": "Visit https://example.com before launch.",
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expectFinding(
      result.warnings,
      "example-domain",
      "content/pages/en/about.mdx",
    );
  });

  it("does not treat MDX comments as buyer-visible content", () => {
    const rootDir = createFixture({
      "content/pages/en/about.mdx":
        "{/* Sample Product should stay in comment only */}\nReal content.",
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("does not treat multiline MDX comments as buyer-visible content", () => {
    const rootDir = createFixture({
      "content/pages/en/about.mdx": [
        "{/*",
        "Sample Product should stay in comment only",
        "*/}",
        "Real content.",
      ].join("\n"),
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("scans canonical locale message pack files", () => {
    const rootDir = createFixture({
      "messages/base/zh/messages.json": JSON.stringify({
        headline: "lorem ipsum",
      }),
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "lorem-ipsum",
      "messages/base/zh/messages.json",
    );
  });

  it("reports the real JSON value line when keys repeat", () => {
    const rootDir = createFixture({
      "messages/base/en/messages.json": [
        "{",
        '  "first": {',
        '    "label": "Clean label"',
        "  },",
        '  "second": {',
        '    "label": "lorem ipsum"',
        "  }",
        "}",
      ].join("\n"),
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "messages/base/en/messages.json",
          line: 6,
          ruleId: "lorem-ipsum",
        }),
      ]),
    );
  });

  it("reports the JSON value line instead of the same-word key line", () => {
    const rootDir = createFixture({
      "messages/base/en/messages.json": [
        "{",
        '  "safe": "Clean copy",',
        '  "placeholder": {',
        '    "label": "placeholder"',
        "  },",
        '  "after": "Clean copy"',
        "}",
      ].join("\n"),
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "messages/base/en/messages.json",
          line: 4,
          ruleId: "placeholder",
        }),
      ]),
    );
  });

  it("warns on fake phone values when they are explicit placeholders", () => {
    const rootDir = createFixture({
      "messages/profiles/b2b-lead/en/messages.json": JSON.stringify({
        phonePlaceholder: "+1 (555) 123-4567",
      }),
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expectFinding(
      result.warnings,
      "fake-phone",
      "messages/profiles/b2b-lead/en/messages.json",
    );
  });

  it("keeps fake phone values blocking when placeholder is only nearby", () => {
    const rootDir = createFixture({
      "content/pages/en/contact.mdx":
        "placeholder\nCall +1 555-123-4567 before launch.",
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(result.errors, "fake-phone", "content/pages/en/contact.mdx");
  });

  it("warns on generic email placeholders without failing", () => {
    const rootDir = createFixture({
      "messages/profiles/b2b-lead/en/messages.json": JSON.stringify({
        contact: "Send requests to your@email before launch.",
      }),
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expectFinding(
      result.warnings,
      "your-email",
      "messages/profiles/b2b-lead/en/messages.json",
    );
  });

  it("does not scan placeholder text inside SVG assets", () => {
    const rootDir = createFixture({
      "public/images/products/product-photo.svg":
        '<svg role="img" aria-label="Sample Product placeholder"></svg>',
      "content/pages/en/about.mdx": "Real content.",
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
  });

  it("does not scan logo references inside SVG XML text", () => {
    const rootDir = createFixture({
      "public/images/products/real-product.svg":
        "<svg><text>/images/logo.svg</text></svg>",
      "content/pages/en/about.mdx": "Real content.",
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("warns on starter residue in SVG asset filenames without scanning SVG text", () => {
    const rootDir = createFixture({
      "public/images/products/sample-product.svg": '<svg role="img"></svg>',
      "content/pages/en/about.mdx": "Real content.",
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expectFinding(
      result.warnings,
      "sample-product",
      "public/images/products/sample-product.svg",
    );
  });

  it("does not treat canonical config logo placeholders as runtime image references", () => {
    const rootDir = createFixture({
      "src/config/single-site.ts": "export const logo = '/images/logo.svg';",
      "content/pages/en/about.mdx": "Real content.",
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
  });

  it("does not treat prose mentions of /images/logo.svg as runtime references", () => {
    const rootDir = createFixture({
      "content/pages/en/about.mdx": [
        "This page mentions `/images/logo.svg` as an example path.",
        "Real content.",
      ].join("\n"),
      "messages/profiles/b2b-lead/en/messages.json": JSON.stringify({
        note: "Mention /images/logo.svg only as a replacement note.",
      }),
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("reports a missing /images/logo.svg MDX image runtime reference", () => {
    const rootDir = createFixture({
      "content/pages/en/about.mdx": "![Company logo](/images/logo.svg)",
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "missing-logo-asset",
      "content/pages/en/about.mdx",
    );
  });

  it("reports a missing /images/logo.svg MDX attribute runtime reference", () => {
    const rootDir = createFixture({
      "content/pages/en/about.mdx": '<img src="/images/logo.svg" alt="Logo" />',
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "missing-logo-asset",
      "content/pages/en/about.mdx",
    );
  });

  it("reports a missing /images/logo.svg MDX JSX image expression runtime reference", () => {
    const rootDir = createFixture({
      "content/pages/en/about.mdx":
        '<img src={"/images/logo.svg"} alt="Logo" />',
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "missing-logo-asset",
      "content/pages/en/about.mdx",
    );
  });

  it("reports a missing /images/logo.svg MDX JSX link expression runtime reference", () => {
    const rootDir = createFixture({
      "content/pages/en/about.mdx":
        "<a href={'/images/logo.svg'}>Logo asset</a>",
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "missing-logo-asset",
      "content/pages/en/about.mdx",
    );
  });

  it("reports a missing /images/logo.svg MDX JSX template expression runtime reference", () => {
    const rootDir = createFixture({
      "content/pages/en/about.mdx":
        '<img src={`/images/logo.svg`} alt="Logo" />',
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("failed");
    expectFinding(
      result.errors,
      "missing-logo-asset",
      "content/pages/en/about.mdx",
    );
  });

  it("passes when logo.svg exists and visible content is clean", () => {
    const rootDir = createFixture({
      "src/config/single-site.ts": "export const logo = '/images/logo.svg';",
      "public/images/logo.svg": '<svg role="img"></svg>',
      "content/pages/en/about.mdx": "Real company content.",
      "messages/profiles/b2b-lead/en/messages.json": JSON.stringify({
        cta: "Contact us",
      }),
    });
    fixtureRoots.push(rootDir);

    const result = runContentReadinessCheck(rootDir);

    expect(result.status).toBe("passed");
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("collectContentReadinessFindings exposes raw findings for callers", () => {
    const rootDir = createFixture({
      "content/pages/en/contact.mdx": "TODO replace this image",
    });
    fixtureRoots.push(rootDir);

    const findings = collectContentReadinessFindings(rootDir);

    expectFinding(findings, "todo-marker", "content/pages/en/contact.mdx");
    expectFinding(
      findings,
      "replace-this-image",
      "content/pages/en/contact.mdx",
    );
  });
});
