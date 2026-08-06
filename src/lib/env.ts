/**
 * 环境变量模块（单一真相源）
 *
 * 约束：生产/测试代码统一从 `@/lib/env` 导入，避免出现多套 schema/mock 分叉。
 */

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const serverEnvSchema = {
  // Email Service (Resend)
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.email().optional(),
  EMAIL_REPLY_TO: z.email().optional(),

  // Data Storage (Airtable)
  AIRTABLE_API_KEY: z.string().min(1).optional(),
  AIRTABLE_BASE_ID: z.string().min(1).optional(),
  AIRTABLE_TABLE_NAME: z.string().min(1).optional(),

  // Bot Protection (Cloudflare Turnstile)
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  TURNSTILE_ALLOWED_HOSTS: z.string().optional(),
  TURNSTILE_BYPASS: z
    .string()
    .optional()
    .transform((val) => val === "true"),

  // Cloudflare deployment account metadata
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1).optional(),

  // Runtime and platform configuration
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).optional(),
  DEPLOYMENT_PLATFORM: z
    .enum(["cloudflare", "development", "self-hosted"])
    .optional(),
  CF_PAGES: z.string().optional(),
  GOOGLE_SITE_VERIFICATION: z.string().min(1).optional(),
  YANDEX_VERIFICATION: z.string().min(1).optional(),

  // Distributed storage and rate limiting
  RATE_LIMIT_PEPPER: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  ALLOW_MEMORY_RATE_LIMIT: z
    .string()
    .optional()
    .transform((val) => val === "true"),

  // Node Environment
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_ENV: z
    .enum(["local", "development", "test", "preview", "production"])
    .optional(),
  NEXT_PHASE: z.string().optional(),

  // CI/CD
  CI: z.string().optional(),
  PLAYWRIGHT_TEST: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  SKIP_ENV_VALIDATION: z
    .string()
    .optional()
    .transform((val) => val === "true"),

  // Security
  SECURITY_HEADERS_ENABLED: z
    .string()
    .default("true")
    .transform((val) => val === "true"),
  CSP_REPORT_URI: z.url().optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
};

export const clientEnvSchema = {
  // Base Configuration
  NEXT_PUBLIC_BASE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
  // 默认值必须是这个站自己的名字。`.env.example` 已经写了 Tucsenberg，但部署
  // 配置（wrangler.jsonc、CI workflow）都没设这个变量，所以线上取到的就是这里的
  // 默认值。留一个启动器时代的公司名在这儿，等于给未来任何一个读它的地方埋了
  // 别人的品牌。
  NEXT_PUBLIC_APP_NAME: z.string().default("Tucsenberg"),
  NEXT_PUBLIC_APP_VERSION: z.string().default("1.0.0"),
  NEXT_PUBLIC_SITE_KEY: z.string().default("tucsenberg"),

  // Analytics & Monitoring
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),

  // Bot Protection (Cloudflare Turnstile Public Key)
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  NEXT_PUBLIC_TURNSTILE_BYPASS: z
    .string()
    .default("false")
    .transform((val) => val === "true"),

  // Development Tools
  NEXT_PUBLIC_TEST_MODE: z
    .string()
    .default("false")
    .transform((val) => val === "true"),

  // Internationalization
  NEXT_PUBLIC_DEFAULT_LOCALE: z.string().default("en"),
  NEXT_PUBLIC_SUPPORTED_LOCALES: z.string().default("en"),

  // Security
  NEXT_PUBLIC_SECURITY_MODE: z.enum(["strict", "relaxed"]).default("strict"),

  // Deployment Platform
  NEXT_PUBLIC_DEPLOYMENT_PLATFORM: z
    .enum(["cloudflare", "development", "self-hosted"])
    .optional(),
};

export const runtimeEnv = {
  // Server
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
  AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID,
  AIRTABLE_TABLE_NAME: process.env.AIRTABLE_TABLE_NAME,
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  TURNSTILE_ALLOWED_HOSTS: process.env.TURNSTILE_ALLOWED_HOSTS,
  TURNSTILE_BYPASS: process.env.TURNSTILE_BYPASS,
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  LOG_LEVEL: process.env.LOG_LEVEL,
  DEPLOYMENT_PLATFORM: process.env.DEPLOYMENT_PLATFORM,
  CF_PAGES: process.env.CF_PAGES,
  GOOGLE_SITE_VERIFICATION: process.env.GOOGLE_SITE_VERIFICATION,
  YANDEX_VERIFICATION: process.env.YANDEX_VERIFICATION,
  RATE_LIMIT_PEPPER: process.env.RATE_LIMIT_PEPPER,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  ALLOW_MEMORY_RATE_LIMIT: process.env.ALLOW_MEMORY_RATE_LIMIT,
  NODE_ENV: process.env.NODE_ENV,
  APP_ENV: process.env.APP_ENV,
  NEXT_PHASE: process.env.NEXT_PHASE,
  CI: process.env.CI,
  PLAYWRIGHT_TEST: process.env.PLAYWRIGHT_TEST,
  SKIP_ENV_VALIDATION: process.env.SKIP_ENV_VALIDATION,
  SECURITY_HEADERS_ENABLED: process.env.SECURITY_HEADERS_ENABLED,
  CSP_REPORT_URI: process.env.CSP_REPORT_URI,
  CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,

  // Client
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  NEXT_PUBLIC_SITE_KEY: process.env.NEXT_PUBLIC_SITE_KEY,
  NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  NEXT_PUBLIC_TURNSTILE_BYPASS: process.env.NEXT_PUBLIC_TURNSTILE_BYPASS,
  NEXT_PUBLIC_TEST_MODE: process.env.NEXT_PUBLIC_TEST_MODE,
  NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  NEXT_PUBLIC_SUPPORTED_LOCALES: process.env.NEXT_PUBLIC_SUPPORTED_LOCALES,
  NEXT_PUBLIC_SECURITY_MODE: process.env.NEXT_PUBLIC_SECURITY_MODE,
  NEXT_PUBLIC_DEPLOYMENT_PLATFORM: process.env.NEXT_PUBLIC_DEPLOYMENT_PLATFORM,
};

function readRawEnvValue(key: string): string | undefined {
  if (typeof process === "undefined") {
    return undefined;
  }

  return process.env[key];
}

interface CloudflareContextStore {
  env?: Record<string, unknown>;
}

const cloudflareContextSymbol = Symbol.for("__cloudflare-context__");

function readCloudflareContextEnvValue(key: string): string | undefined {
  const context = (
    globalThis as typeof globalThis &
      Record<symbol, CloudflareContextStore | undefined>
  )[cloudflareContextSymbol];
  const value = context?.env?.[key];

  return typeof value === "string" ? value : undefined;
}

function shouldSkipEnvValidation(): boolean {
  return readRawEnvValue("SKIP_ENV_VALIDATION") === "true";
}

export type { PublicRuntimeEnvKey } from "./public-runtime-env";

// 创建类型安全的环境变量配置
export const env = createEnv({
  server: serverEnvSchema,
  client: clientEnvSchema,
  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv,
  /**
   * Run `build` or `dev` with SKIP_ENV_VALIDATION to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: shouldSkipEnvValidation(),
  /**
   * Makes it so that empty strings are treated as undefined.
   * `SOME_VAR: z.string()` and `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});

function readProcessEnvValue(key: keyof typeof env): string | undefined {
  return readCloudflareContextEnvValue(key) ?? readRawEnvValue(key);
}

function readValidatedEnvValue(key: keyof typeof env) {
  try {
    return env[key];
  } catch {
    return undefined;
  }
}

type RuntimeNodeEnv = "development" | "test" | "production";
type RuntimeAppEnv =
  "local" | "development" | "test" | "preview" | "production";

function coerceRuntimeNodeEnv(
  value: string | undefined,
): RuntimeNodeEnv | undefined {
  if (value === "development" || value === "test" || value === "production") {
    return value;
  }
  return undefined;
}

function coerceRuntimeAppEnv(
  value: string | undefined,
): RuntimeAppEnv | undefined {
  if (
    value === "local" ||
    value === "development" ||
    value === "test" ||
    value === "preview" ||
    value === "production"
  ) {
    return value;
  }
  return undefined;
}

export function getRuntimeEnvString(key: keyof typeof env): string | undefined {
  const runtimeValue = readProcessEnvValue(key);
  if (runtimeValue !== undefined) {
    return runtimeValue;
  }

  const value = readValidatedEnvValue(key);
  return typeof value === "string" ? value : undefined;
}

export function getRuntimeEnvBoolean(
  key: keyof typeof env,
): boolean | undefined {
  const runtimeValue = readProcessEnvValue(key);
  if (runtimeValue !== undefined) {
    return runtimeValue === "true";
  }

  const value = readValidatedEnvValue(key);
  return typeof value === "boolean" ? value : undefined;
}

export function getRuntimeNodeEnv(): RuntimeNodeEnv | undefined {
  return coerceRuntimeNodeEnv(getRuntimeEnvString("NODE_ENV"));
}

export function getRuntimeAppEnv(): RuntimeAppEnv | undefined {
  return coerceRuntimeAppEnv(getRuntimeEnvString("APP_ENV"));
}

export function isRuntimeDevelopment(): boolean {
  return getRuntimeNodeEnv() === "development";
}

export function isRuntimeProduction(): boolean {
  return getRuntimeNodeEnv() === "production";
}

export function isRuntimeTest(): boolean {
  return getRuntimeNodeEnv() === "test";
}

export function isRuntimeCi(): boolean {
  return getRuntimeEnvString("CI") === "true";
}

export function isRuntimePlaywright(): boolean {
  return getRuntimeEnvBoolean("PLAYWRIGHT_TEST") === true;
}

export function isRuntimeProductionBuildPhase(): boolean {
  return getRuntimeEnvString("NEXT_PHASE") === "phase-production-build";
}

export function isRuntimeCloudflare(): boolean {
  return (
    getRuntimeEnvString("DEPLOYMENT_PLATFORM") === "cloudflare" ||
    getRuntimeEnvString("NEXT_PUBLIC_DEPLOYMENT_PLATFORM") === "cloudflare"
  );
}

// 提供必需环境变量检查（仅用于字符串类型的环境变量）
export function requireEnvVar(key: keyof typeof env): string {
  const value = env[key];
  if (!value || typeof value === "boolean" || typeof value === "number") {
    throw new Error(
      `Required environment variable ${key} is not set or is not a string`,
    );
  }
  return value;
}
