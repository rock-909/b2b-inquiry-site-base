import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const ENV_FACADE = "src/lib/env.ts";
const ENV_SCHEMAS = "src/lib/env-schemas.ts";
const ENV_RUNTIME = "src/lib/env-runtime.ts";
const PUBLIC_ENV = "src/lib/public-env.ts";
const PUBLIC_RUNTIME_ENV = "src/lib/public-runtime-env.ts";
const LOGGER = "src/lib/logger.ts";
const LOGGER_CORE = "src/lib/logger-core.ts";

const FORBIDDEN_SERVER_ENV_KEYS = [
  "RESEND_API_KEY",
  "AIRTABLE_API_KEY",
  "TURNSTILE_SECRET_KEY",
  "RATE_LIMIT_PEPPER",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

function read(repoPath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads repo-local files from a fixed allowlist
  return readFileSync(repoPath, "utf8");
}

function walkSourceFiles(dir: string, results: string[] = []) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test recursively scans the repo-local src tree
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", ".next"].includes(entry.name)) {
      continue;
    }

    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(absolutePath, results);
      continue;
    }

    if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
      results.push(relative(process.cwd(), absolutePath).split(sep).join("/"));
    }
  }

  return results;
}

function normalizeRepoPath(absolutePath: string): string {
  return relative(process.cwd(), absolutePath).split(sep).join("/");
}

function resolvesToServerEnvFacade(
  repoPath: string,
  specifier: string,
): boolean {
  const cleaned = specifier.replace(/^['"]|['"]$/g, "");
  const absoluteImporter = join(process.cwd(), repoPath);
  const resolved = resolve(dirname(absoluteImporter), cleaned);
  const normalized = normalizeRepoPath(resolved);

  return (
    normalized === ENV_FACADE ||
    normalized === "src/lib/env" ||
    (normalized.endsWith("/env.ts") && normalized.includes("src/lib/env"))
  );
}

function collectQuotedSpecifiers(source: string, pattern: RegExp): string[] {
  const specifiers: string[] = [];
  for (const match of source.matchAll(pattern)) {
    if (match[1]) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

function referencesServerEnvFacade(source: string, repoPath: string): boolean {
  const aliasPatterns = [
    /from\s+["']@\/lib\/env(?:\.ts)?["']/,
    /import\s+["']@\/lib\/env(?:\.ts)?["']/,
    /export\s+\{[^}]+\}\s+from\s+["']@\/lib\/env(?:\.ts)?["']/,
    /export\s+type\s+\{[^}]+\}\s+from\s+["']@\/lib\/env(?:\.ts)?["']/,
    /import\s*\(\s*["']@\/lib\/env(?:\.ts)?["']\s*\)/,
    /require\s*\(\s*["']@\/lib\/env(?:\.ts)?["']\s*\)/,
  ];

  if (aliasPatterns.some((pattern) => pattern.test(source))) {
    return true;
  }

  const relativePatterns = [
    /from\s+["'](\.\.?\/[^"']+)["']/g,
    /import\s+["'](\.\.?\/[^"']+)["']/g,
    /import\s*\(\s*["'](\.\.?\/[^"']+)["']\s*\)/g,
    /require\s*\(\s*["'](\.\.?\/[^"']+)["']\s*\)/g,
  ];

  for (const pattern of relativePatterns) {
    for (const specifier of collectQuotedSpecifiers(source, pattern)) {
      if (resolvesToServerEnvFacade(repoPath, specifier)) {
        return true;
      }
    }
  }

  return false;
}

describe("referencesServerEnvFacade helper", () => {
  const negativeFixtures: Array<{
    label: string;
    source: string;
    repoPath: string;
  }> = [
    {
      label: "alias import",
      source: 'import { isPublicRuntimeProduction } from "@/lib/env";',
      repoPath: "src/components/example.tsx",
    },
    {
      label: "side-effect import",
      source: 'import "@/lib/env";',
      repoPath: "src/components/example.tsx",
    },
    {
      label: "re-export",
      source: 'export { getPublicRuntimeEnvString } from "@/lib/env";',
      repoPath: "src/components/example.tsx",
    },
    {
      label: "dynamic import",
      source: 'const envModule = import("@/lib/env");',
      repoPath: "src/components/example.tsx",
    },
    {
      label: "require",
      source: 'const envModule = require("@/lib/env");',
      repoPath: "src/components/example.tsx",
    },
    {
      label: "alias with .ts extension",
      source: 'import type { PublicRuntimeEnvKey } from "@/lib/env.ts";',
      repoPath: "src/components/example.tsx",
    },
    {
      label: "relative path to env facade",
      source: 'import { env } from "../lib/env";',
      repoPath: "src/components/example.tsx",
    },
  ];

  it.each(negativeFixtures)(
    "detects $label bypass patterns",
    ({ source, repoPath }) => {
      expect(referencesServerEnvFacade(source, repoPath)).toBe(true);
    },
  );

  it("ignores public-runtime-env imports", () => {
    expect(
      referencesServerEnvFacade(
        'import { isPublicRuntimeProduction } from "@/lib/public-runtime-env";',
        "src/components/example.tsx",
      ),
    ).toBe(false);
  });
});

describe("env module boundaries", () => {
  it("keeps src/lib/env.ts as the server validation facade", () => {
    const source = read(ENV_FACADE);

    expect(source).toContain('import { createEnv } from "@t3-oss/env-nextjs"');
    expect(source).toContain("export const env = createEnv");
    expect(source).toContain("export const serverEnvSchema");
    expect(source).toContain("export const clientEnvSchema");
    expect(source).toContain("export const runtimeEnv");
    expect(source).toContain("export function getRuntimeEnvString");
    expect(source).toContain("export function requireEnvVar");
  });

  it("keeps zod-free public runtime env in a dedicated client-safe module", () => {
    expect(existsSync(PUBLIC_RUNTIME_ENV), PUBLIC_RUNTIME_ENV).toBe(true);

    const source = read(PUBLIC_RUNTIME_ENV);

    expect(source).not.toMatch(/from ["']zod["']/);
    expect(source).not.toMatch(/@t3-oss\/env-nextjs/);
    expect(source).not.toContain("createEnv");
    expect(source).not.toContain('import "@/lib/env"');
    expect(source).not.toContain('from "@/lib/env"');
    expect(source).not.toContain('import "./env"');
    expect(source).not.toContain('from "./env"');
    expect(source).not.toContain('import "server-only"');

    for (const forbiddenKey of FORBIDDEN_SERVER_ENV_KEYS) {
      expect(source).not.toContain(forbiddenKey);
    }

    expect(source).toContain("process.env.NODE_ENV");
    expect(source).toContain("process.env.NEXT_PUBLIC_");
    expect(source).toContain("export function getPublicRuntimeEnvString");
    expect(source).toContain("export function getPublicRuntimeEnvBoolean");
    expect(source).toContain("export function isPublicRuntimeProduction");
    expect(source).toContain("export function isPublicRuntimeDevelopment");
    expect(source).toContain("NEXT_PUBLIC_BASE_URL");
    expect(source).toContain("NEXT_PUBLIC_DEPLOYMENT_PLATFORM");
  });

  it("removes split env/logger facades after consolidation", () => {
    expect(existsSync(ENV_SCHEMAS), ENV_SCHEMAS).toBe(false);
    expect(existsSync(ENV_RUNTIME), ENV_RUNTIME).toBe(false);
    expect(existsSync(PUBLIC_ENV), PUBLIC_ENV).toBe(false);
    expect(existsSync(LOGGER_CORE), LOGGER_CORE).toBe(false);
  });

  it("keeps app code off retired env and logger modules", () => {
    const forbiddenImports = [
      "@/lib/env-runtime",
      "@/lib/env-schemas",
      "@/lib/public-env",
      "@/lib/logger-core",
      "./env-runtime",
      "./env-schemas",
      "./public-env",
    ];
    const offenders = walkSourceFiles("src").filter((repoPath) => {
      const source = read(repoPath);
      return forbiddenImports.some((importPath) => source.includes(importPath));
    });

    expect(offenders).toEqual([]);
  });

  it('keeps "use client" files off the server env facade', () => {
    const offenders = walkSourceFiles("src").filter((repoPath) => {
      const source = read(repoPath);
      const isClientComponent =
        source.includes('"use client"') || source.includes("'use client'");

      return isClientComponent && referencesServerEnvFacade(source, repoPath);
    });

    expect(offenders).toEqual([]);
  });

  it("keeps CSP nonce out of public env contracts", () => {
    expect(read(PUBLIC_RUNTIME_ENV)).not.toContain("NEXT_PUBLIC_CSP_NONCE");
    expect(read(ENV_FACADE)).not.toContain("NEXT_PUBLIC_CSP_NONCE");
  });

  it("keeps the consolidated logger browser-safe while retaining sanitizers", () => {
    const loggerSource = read(LOGGER);

    expect(loggerSource).not.toContain('import "server-only"');
    expect(loggerSource).not.toContain("@/lib/env");
    expect(loggerSource).not.toContain("./env");
    expect(loggerSource).not.toContain("env-schemas");
    expect(loggerSource).not.toContain("env-runtime");
    expect(loggerSource).toContain("sanitizeEmail");
    expect(loggerSource).toContain("sanitizeIP");
    expect(loggerSource).toContain("sanitizeLogContext");
  });

  it("keeps Client Components off PII logger helpers", () => {
    const offenders = walkSourceFiles("src").filter((repoPath) => {
      const source = read(repoPath);
      const isClientComponent =
        source.includes('"use client"') || source.includes("'use client'");

      return (
        isClientComponent &&
        (source.includes("sanitizeEmail") ||
          source.includes("sanitizeIP") ||
          source.includes("sanitizeLogContext"))
      );
    });

    expect(offenders).toEqual([]);
  });
});
