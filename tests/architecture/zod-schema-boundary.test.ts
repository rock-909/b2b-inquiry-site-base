import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const TEST_SCAN_ROOTS = ["src", "tests"] as const;
const SOURCE_SCAN_ROOT = "src";
const SETUP_SCAN_ROOT = "src/test";
const V3_EMAIL_IDIOM = "z.string().email(";
const SCHEMA_REJECTION_PATTERN =
  /\.safeParse\([^)]*\)\.success\)\.toBe\(false\)|expect\(\s*\w+\.success\s*\)\.toBe\(false\)|expect\(\s*\w+\.error\b/u;
const ZOD_MOCK_PATTERN = /\bvi\.(?:mock|doMock)\(\s*["']zod["']/u;
const ZOD_UNMOCK_PATTERN = /\bvi\.unmock\(\s*["']zod["']\s*\)/u;

function collectTestFiles(root: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture scanner is limited to fixed test roots.
  const stats = statSync(root);
  if (stats.isFile()) {
    return /\.(?:test|spec)\.(?:ts|tsx)$/u.test(root) ? [root] : [];
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture scanner is limited to fixed test roots.
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(root, entry.name);
    if (entry.isDirectory()) return collectTestFiles(entryPath);
    return entry.isFile() && /\.(?:test|spec)\.(?:ts|tsx)$/u.test(entry.name)
      ? [entryPath]
      : [];
  });
}

function collectSourceFiles(root: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture scanner is limited to the fixed src root.
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(root, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    return entry.isFile() && /\.tsx?$/u.test(entry.name) ? [entryPath] : [];
  });
}

describe("Zod schema boundary", () => {
  // Schema rejection tests are only proof if the schema library is real. The
  // per-test scan below only walks `*.test.ts`, so a mock parked in a shared
  // setup file would turn every rejection test green without tripping it.
  it("uses real Zod by default in the shared Vitest setup", () => {
    const mocked = collectSourceFiles(SETUP_SCAN_ROOT).filter((filePath) => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- file paths come from collectSourceFiles under SETUP_SCAN_ROOT.
      const source = readFileSync(filePath, "utf8");
      return ZOD_MOCK_PATTERN.test(source);
    });

    expect(mocked).toEqual([]);
  });

  it("does not reintroduce the Zod v3 z.string().email() idiom in src (use z.email())", () => {
    const failures = collectSourceFiles(SOURCE_SCAN_ROOT).filter((filePath) => {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- file paths come from collectSourceFiles under SOURCE_SCAN_ROOT.
      const source = readFileSync(filePath, "utf8");
      return source.includes(V3_EMAIL_IDIOM);
    });

    expect(failures).toEqual([]);
  });

  it("does not use z.any in production lead schemas", () => {
    const leadSchema = readFileSync(
      "src/lib/lead-pipeline/lead-schema.ts",
      "utf8",
    );

    expect(leadSchema).not.toContain("z.any()");
    expect(leadSchema).not.toMatch(/\n\s*\.any\(\)/);
  });

  it("does not mock Zod in tests because real Zod is the default validation proof", () => {
    const failures = TEST_SCAN_ROOTS.flatMap(collectTestFiles).flatMap(
      (filePath) => {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- file paths come from collectTestFiles under TEST_SCAN_ROOTS.
        const source = readFileSync(filePath, "utf8");
        return ZOD_MOCK_PATTERN.test(source) ? [filePath] : [];
      },
    );

    expect(failures).toEqual([]);
  });

  it("does not carry redundant real-Zod opt-in markers now that real Zod is default", () => {
    const failures = TEST_SCAN_ROOTS.flatMap(collectTestFiles).flatMap(
      (filePath) => {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- file paths come from collectTestFiles under TEST_SCAN_ROOTS.
        const source = readFileSync(filePath, "utf8");
        return ZOD_UNMOCK_PATTERN.test(source) ? [filePath] : [];
      },
    );

    expect(failures).toEqual([]);
  });

  it("does not classify success-only safeParse tests as rejection tests", () => {
    const successOnlySafeParseTest = `
      const result = schema.safeParse(validPayload);
      expect(result.success).toBe(true);
    `;

    expect(SCHEMA_REJECTION_PATTERN.test(successOnlySafeParseTest)).toBe(false);
  });

  it("does not require a vi.unmock marker for rejection tests now that real Zod is default", () => {
    const rejectionWithDefaultRealZod = `
      const result = schema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    `;

    expect(SCHEMA_REJECTION_PATTERN.test(rejectionWithDefaultRealZod)).toBe(
      true,
    );
    expect(ZOD_MOCK_PATTERN.test(rejectionWithDefaultRealZod)).toBe(false);
  });
});
