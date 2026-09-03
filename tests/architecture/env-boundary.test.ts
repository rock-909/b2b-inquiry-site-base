import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const ENV_FACADE = "src/lib/env.ts";
const PUBLIC_RUNTIME_ENV = "src/lib/public-runtime-env.ts";
const LOGGER = "src/lib/logger.ts";

const FORBIDDEN_SERVER_ENV_KEYS = [
  "RESEND_API_KEY",
  "AIRTABLE_API_KEY",
  "TURNSTILE_SECRET_KEY",
  "RATE_LIMIT_PEPPER",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

function read(repoPath: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 测试只读取固定仓库文件或下方 src 扫描结果
  return readFileSync(repoPath, "utf8");
}

function sourceFiles(dir: string, results: string[] = []): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 扫描范围固定为仓库 src
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(entryPath, results);
    } else if (
      entry.isFile() &&
      [".ts", ".tsx"].includes(extname(entry.name))
    ) {
      results.push(relative(process.cwd(), entryPath).split(sep).join("/"));
    }
  }
  return results;
}

describe("env module boundaries", () => {
  it("keeps public runtime env client-safe and allowlisted", () => {
    const source = read(PUBLIC_RUNTIME_ENV);

    expect(source).not.toMatch(
      /from ["']zod["']|@t3-oss\/env-nextjs|createEnv/u,
    );
    expect(source).not.toMatch(
      /(?:from|import)\s+["'](?:@\/lib\/env|\.\/env)["']/u,
    );
    expect(source).not.toContain('import "server-only"');

    for (const forbiddenKey of FORBIDDEN_SERVER_ENV_KEYS) {
      expect(source).not.toContain(forbiddenKey);
    }
  });

  it('keeps "use client" files off server env and PII helpers', () => {
    const offenders = sourceFiles("src").filter((repoPath) => {
      const source = read(repoPath);
      const isClientComponent = /^\s*["']use client["'];/u.test(source);

      return (
        isClientComponent &&
        (/@\/lib\/env(?:\.ts)?["']/u.test(source) ||
          /\b(?:sanitizeEmail|sanitizeIP)\b/u.test(source))
      );
    });

    expect(offenders).toEqual([]);
  });

  it("keeps sensitive nonce and server keys out of public env contracts", () => {
    const publicEnv = read(PUBLIC_RUNTIME_ENV);
    const serverEnv = read(ENV_FACADE);

    expect(publicEnv).not.toContain("NEXT_PUBLIC_CSP_NONCE");
    expect(serverEnv).not.toContain("NEXT_PUBLIC_CSP_NONCE");
    for (const forbiddenKey of FORBIDDEN_SERVER_ENV_KEYS) {
      expect(publicEnv).not.toContain(forbiddenKey);
    }
  });

  it("keeps the logger browser-safe", () => {
    const source = read(LOGGER);

    expect(source).not.toContain('import "server-only"');
    expect(source).not.toMatch(/(?:@\/lib\/env|\.\/env)/u);
  });
});
