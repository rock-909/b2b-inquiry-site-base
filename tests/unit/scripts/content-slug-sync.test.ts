/* eslint-disable security/detect-non-literal-fs-filename -- isolated temp fixtures */
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CLI_PATH = path.resolve(__dirname, "../../../scripts/starter-checks.js");
const trashRoot = path.join(os.tmpdir(), "tucsenberg-content-cli-trash");
let tmpDir: string;

function runCli(args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolve) => {
      const proc = spawn("node", [CLI_PATH, "content-slugs", ...args], {
        cwd: tmpDir,
      });
      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (data) => (stdout += data.toString()));
      proc.stderr.on("data", (data) => (stderr += data.toString()));
      proc.on("close", (code) => resolve({ code, stdout, stderr }));
    },
  );
}

function createPage(frontmatter: Record<string, unknown>) {
  const dir = path.join(tmpDir, "content", "pages", "en");
  fs.mkdirSync(dir, { recursive: true });
  const yaml = Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join("\n");
  fs.writeFileSync(path.join(dir, "about.mdx"), `---\n${yaml}\n---\n`);
}

function validFrontmatter(ogImage = "/images/og.png") {
  return {
    locale: "en",
    title: "About",
    description: "About page description",
    slug: "about",
    publishedAt: "2026-01-01",
    updatedAt: "2026-01-02",
    seo: {
      title: "About SEO",
      description: "About SEO description",
      ogImage,
    },
  };
}

describe("content-slugs CLI", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "content-cli-"));
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

  it("does not expose retired collection or locale overrides", async () => {
    const result = await runCli(["--help"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("--strict-frontmatter");
    expect(result.stdout).not.toContain("--collections");
    expect(result.stdout).not.toContain("--locales");
  });

  it("skips pair comparison but still validates frontmatter on one locale", async () => {
    createPage(validFrontmatter());
    const result = await runCli(["--strict-frontmatter"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Single locale site");
    expect(result.stdout).toContain(
      "All frontmatter/SEO contract validations passed.",
    );
  });

  it("fails strict validation when an OG image is missing", async () => {
    createPage(validFrontmatter("/images/missing.png"));
    const result = await runCli(["--strict-frontmatter"]);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain("Missing OG Images");
  });

  it("rejects retired collection and locale overrides", async () => {
    const collectionResult = await runCli(["--collections=posts"]);
    const localeResult = await runCli(["--locales=en,fr"]);

    expect(collectionResult.code).toBe(1);
    expect(collectionResult.stderr).toContain("Unknown option");
    expect(localeResult.code).toBe(1);
    expect(localeResult.stderr).toContain("Unknown option");
  });

  it("writes the optional report with the fixed pages collection", async () => {
    createPage(validFrontmatter());
    const result = await runCli(["--json"]);
    const report = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, "reports", "content-slug-sync-report.json"),
        "utf8",
      ),
    ) as { checkedCollections: string[]; checkedLocales: string[] };

    expect(result.code).toBe(0);
    expect(report).toMatchObject({
      checkedCollections: ["pages"],
      checkedLocales: ["en"],
    });
  });
});
