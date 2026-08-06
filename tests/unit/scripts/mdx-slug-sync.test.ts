/* eslint-disable security/detect-non-literal-fs-filename -- isolated temp fixtures */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { captureExpectedConsoleErrors } from "@/test/console";

const contentChecks = require("../../../scripts/quality/checks/content-slugs.js");
const contentManifest = require("../../../scripts/quality/checks/content-manifest.js");

const {
  validateContentFrontmatterContract,
  validateMdxSlugSync,
  writeContentSlugJsonReport,
} = contentChecks;
const {
  createContentManifestContext,
  generateContentManifest,
  runContentManifestGenerator,
  writeFileAtomic,
} = contentManifest;

describe("page content checks", () => {
  let tmpDir: string;
  const trashRoot = path.join(os.tmpdir(), "tucsenberg-content-test-trash");

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "content-check-"));
    fs.mkdirSync(path.join(tmpDir, "public", "images"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "public", "images", "og.png"), "");
  });

  afterEach(() => {
    if (!fs.existsSync(tmpDir)) return;
    fs.mkdirSync(trashRoot, { recursive: true });
    fs.renameSync(
      tmpDir,
      path.join(trashRoot, `${path.basename(tmpDir)}-${Date.now()}`),
    );
  });

  function createPage(
    locale: string,
    filename: string,
    frontmatter: Record<string, unknown>,
  ): string {
    const dir = path.join(tmpDir, "content", "pages", locale);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    const yaml = Object.entries(frontmatter)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join("\n");
    fs.writeFileSync(filePath, `---\n${yaml}\n---\n\nPage content`);
    return filePath;
  }

  function validFrontmatter(overrides: Record<string, unknown> = {}) {
    return {
      locale: "en",
      title: "About",
      description: "About page description",
      slug: "about",
      publishedAt: "2026-01-01",
      updatedAt: "2026-01-02",
      draft: false,
      seo: {
        title: "About SEO",
        description: "About SEO description",
        ogImage: "/images/og.png",
      },
      ...overrides,
    };
  }

  it("validates page pairs only when more than one locale is configured", () => {
    createPage("en", "about.mdx", { slug: "about" });
    createPage("fr", "about.mdx", { slug: "a-propos" });
    createPage("en", "contact.mdx", { slug: "contact" });

    const singleLocale = validateMdxSlugSync({
      rootDir: tmpDir,
      locales: ["en"],
    });
    const twoLocales = validateMdxSlugSync({
      rootDir: tmpDir,
      locales: ["en", "fr"],
    });

    expect(singleLocale).toMatchObject({ ok: true, checkedLocales: ["en"] });
    expect(singleLocale.stats.totalPairs).toBe(0);
    expect(twoLocales.ok).toBe(false);
    expect(
      twoLocales.issues.map((issue: { type: string }) => issue.type),
    ).toEqual(["slug_mismatch", "missing_pair"]);
  });

  it("reports invalid page frontmatter and missing public OG images", () => {
    createPage(
      "en",
      "about.mdx",
      validFrontmatter({
        locale: "fr",
        slug: "wrong",
        publishedAt: "2026/01/01",
        seo: {
          title: "About SEO",
          description: "About SEO description",
          ogImage: "/images/missing.png",
        },
      }),
    );

    const result = validateContentFrontmatterContract({
      rootDir: tmpDir,
      locales: ["en"],
      strictFrontmatter: true,
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "locale" }),
        expect.objectContaining({ field: "slug" }),
        expect.objectContaining({ field: "publishedAt" }),
        expect.objectContaining({ type: "missing_og_image" }),
      ]),
    );
  });

  it("fails instead of reporting green when no pages/en MDX files are scanned", () => {
    const result = validateContentFrontmatterContract({
      rootDir: tmpDir,
      locales: ["en"],
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({ field: "scan", collection: "pages" }),
    ]);
  });

  it("writes the optional JSON report under the supplied root", () => {
    const result = validateMdxSlugSync({ rootDir: tmpDir, locales: ["en"] });
    writeContentSlugJsonReport(result, tmpDir);

    const report = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, "reports", "content-slug-sync-report.json"),
        "utf8",
      ),
    ) as { checkedCollections: string[]; checkedLocales: string[] };
    expect(report).toMatchObject({
      checkedCollections: ["pages"],
      checkedLocales: ["en"],
    });
  });

  it("generates the current pages/en manifest entry", () => {
    createPage("en", "about.mdx", validFrontmatter());
    const manifest = generateContentManifest(
      createContentManifestContext(tmpDir),
    );
    expect(manifest.entries).toHaveLength(1);
    expect(manifest.byKey["pages/en/about"]).toBeDefined();
  });

  it("rejects invalid frontmatter before generating a manifest", () => {
    createPage("en", "about.mdx", {
      ...validFrontmatter(),
      seo: { title: "About SEO" },
    });

    expect(() =>
      generateContentManifest(createContentManifestContext(tmpDir)),
    ).toThrow(/seo\.description is required/u);
  });

  it("checks manifest freshness without rewriting stale output", () => {
    const consoleError = captureExpectedConsoleErrors(
      "Content manifest artifacts are stale:",
      "  - ",
      "Run `node scripts/starter-checks.js content-manifest`",
    );
    createPage("en", "about.mdx", validFrontmatter());
    const context = createContentManifestContext(tmpDir);
    fs.mkdirSync(path.dirname(context.manifestTsOutput), { recursive: true });
    fs.writeFileSync(context.manifestTsOutput, "stale");

    expect(runContentManifestGenerator(context, { check: true })).toBe(false);
    expect(fs.readFileSync(context.manifestTsOutput, "utf8")).toBe("stale");
    expect(consoleError).toHaveBeenCalledWith(
      `  - ${context.manifestTsOutput}`,
    );
  });

  it("replaces generated artifacts atomically", () => {
    const output = path.join(tmpDir, "reports", "artifact.txt");
    writeFileAtomic(output, "first");
    writeFileAtomic(output, "second");

    expect(fs.readFileSync(output, "utf8")).toBe("second");
    expect(
      fs
        .readdirSync(path.dirname(output))
        .some((file) => file.includes(".tmp-")),
    ).toBe(false);
  });

  it("loads configured locales for the real CLI", () => {
    fs.writeFileSync(
      path.join(tmpDir, "i18n-locales.config.js"),
      'module.exports = { locales: ["en", "fr"], defaultLocale: "en" };\n',
    );
    createPage("en", "about.mdx", { slug: "about" });
    createPage("fr", "about.mdx", { slug: "about" });

    const result = spawnSync(
      "node",
      [
        path.resolve(__dirname, "../../../scripts/starter-checks.js"),
        "content-slugs",
      ],
      { cwd: tmpDir, encoding: "utf8" },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Locales: en, fr");
    expect(result.stdout).toContain("Total pairs: 1");
  });
});
