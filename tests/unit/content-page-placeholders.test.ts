import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CONTENT_PAGES_DIR = join(process.cwd(), "content", "pages");

const FORBIDDEN_PLACEHOLDERS = [
  "Example Showcase Company",
  "示例展示型公司",
  "sales@example.com",
  "Example Business Park",
  "Example City",
  "[Company Name]",
  "[company-domain]",
  "[Company Address]",
  "[Company Phone]",
  "[PROJECT_NAME]",
  "[EU Representative Contact]",
  "[公司名称]",
  "[公司域名]",
  "[公司地址]",
  "[公司电话]",
  "[欧盟代表联系方式]",
] as const;

// 点名清单会静默变短：删掉一个文件后清单少一条不会报错，只会少查。
// public 下的 .txt 改成遍历，新增文件自动进入检查范围。
function collectPublicTextFiles(dir: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 测试扫描器锁定在仓库的 public 根目录
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return collectPublicTextFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".txt") ? [fullPath] : [];
  });
}

const PUBLIC_LEGAL_AND_SECURITY_FILES = [
  join(process.cwd(), "content/pages/en/privacy.mdx"),
  join(process.cwd(), "content/pages/en/terms.mdx"),
  ...collectPublicTextFiles(join(process.cwd(), "public")),
];

const CANONICAL_PLACEHOLDER_FILES = [
  join(process.cwd(), "src/config/single-site.ts"),
  join(process.cwd(), "messages/base/en/messages.json"),
  join(process.cwd(), "messages/profiles/catalog/en/messages.json"),
  join(process.cwd(), "messages/profiles/b2b-lead/en/messages.json"),
] as const;

const FORBIDDEN_PUBLIC_LEGAL_AND_SECURITY_CLAIMS = [
  "T/T",
  "L/C",
  "FOB",
  "CIF",
  "30-45 days",
  "12 months",
  "Create an account",
  "Username, password",
  "security@example.com",
  "Example Showcase Company",
  "1.5%",
  "15 days",
  "10 business days",
  "每月1.5%",
  "15天",
  "10个工作日",
  "Replace this line",
  "before public launch",
] as const;

const FORBIDDEN_CANONICAL_PLACEHOLDER_RESIDUE = [
  "240021Q09730R0S",
  "wave1-blocked",
  "Task 8",
  "Task 9",
  "Task 10",
] as const;

function collectMdxFiles(dir: string): string[] {
  // Test-only scanner: directory is anchored to the repo's static content/pages root.
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Test scanner is constrained to the static content/pages root.
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return collectMdxFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".mdx") ? [fullPath] : [];
  });
}

describe("content page placeholder guard", () => {
  it("does not ship unresolved brand placeholders in content/pages", () => {
    const failures = collectMdxFiles(CONTENT_PAGES_DIR).flatMap((filePath) => {
      // File paths come from collectMdxFiles under the static content/pages root.
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- File paths come from collectMdxFiles under content/pages.
      const content = readFileSync(filePath, "utf8");
      return FORBIDDEN_PLACEHOLDERS.filter((placeholder) =>
        content.includes(placeholder),
      ).map((placeholder) => `${filePath}: ${placeholder}`);
    });

    expect(failures).toEqual([]);
  });

  it("does not ship specific customer promises in public legal and security placeholders", () => {
    const failures = PUBLIC_LEGAL_AND_SECURITY_FILES.flatMap((filePath) => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- 路径来自固定的两份 MDX 加上 public 目录扫描
      const content = readFileSync(filePath, "utf8");
      return FORBIDDEN_PUBLIC_LEGAL_AND_SECURITY_CLAIMS.filter((claim) =>
        content.includes(claim),
      ).map((claim) => `${filePath}: ${claim}`);
    });

    expect(failures).toEqual([]);
  });

  it("keeps canonical starter placeholders visibly generic and free of old task notes", () => {
    const failures = CANONICAL_PLACEHOLDER_FILES.flatMap((filePath) => {
      // Static test fixture list points only at canonical starter replacement files.
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- File paths are fixed in CANONICAL_PLACEHOLDER_FILES.
      const content = readFileSync(filePath, "utf8");
      return FORBIDDEN_CANONICAL_PLACEHOLDER_RESIDUE.filter((residue) =>
        content.includes(residue),
      ).map((residue) => `${filePath}: ${residue}`);
    });

    expect(failures).toEqual([]);
  });
});
