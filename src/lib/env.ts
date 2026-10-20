/**
 * 环境变量模块（单一真相源）
 *
 * 约束：生产/测试代码统一从 `@/lib/env` 导入，避免出现多套 schema/mock 分叉。
 *
 * 读取规则：服务端运行时一律用 `getRuntimeEnvString` / `getRuntimeEnvBoolean`
 * （Cloudflare 上 OpenNext 已把绑定写进 process.env）；`env` 只给构建期配置，
 * `runtimeEnv` 只给需要构建期内联的 `NEXT_PUBLIC_*`。
 *
 * 不加 `server-only`：next.config.ts 构建期经 src/config/security.ts 加载本文件，
 * 那里没有 react-server 条件，`server-only` 会直接抛错。客户端误用由 semgrep 拦截。
 */

import { createEnv } from "@t3-oss/env-nextjs";
import { enum as zEnum, string, url } from "zod";
import {
  emailAddressSchema,
  emailSenderSchema,
  logLevelSchema,
} from "./env-formats";

export const serverEnvSchema = {
  // Email Service (Resend)
  RESEND_API_KEY: string().min(1).optional(),
  EMAIL_FROM: emailSenderSchema.optional(),
  INQUIRY_RECIPIENT_EMAIL: emailAddressSchema.optional(),

  // Data Storage (Airtable)
  AIRTABLE_API_KEY: string().min(1).optional(),
  AIRTABLE_BASE_ID: string().min(1).optional(),
  AIRTABLE_TABLE_NAME: string().min(1).optional(),

  // Bot Protection (Cloudflare Turnstile)
  TURNSTILE_SECRET_KEY: string().min(1).optional(),
  TURNSTILE_ALLOWED_HOSTS: string().optional(),
  TURNSTILE_BYPASS: string()
    .optional()
    .transform((val) => val === "true"),

  // Runtime and platform configuration
  LOG_LEVEL: logLevelSchema.optional(),
  DEPLOYMENT_PLATFORM: zEnum(["cloudflare", "development"]).optional(),
  GOOGLE_SITE_VERIFICATION: string().min(1).optional(),
  BING_SITE_VERIFICATION: string().min(1).optional(),

  // Distributed storage and rate limiting
  RATE_LIMIT_PEPPER: string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: url().optional(),
  UPSTASH_REDIS_REST_TOKEN: string().min(1).optional(),

  // Node Environment
  NODE_ENV: zEnum(["development", "test", "production"]).default("development"),
  APP_ENV: zEnum([
    "local",
    "development",
    "test",
    "preview",
    "production",
  ]).optional(),

  // CI/CD
  CI: string().optional(),
  SKIP_ENV_VALIDATION: string()
    .optional()
    .transform((val) => val === "true"),

  // Security
  SECURITY_HEADERS_ENABLED: string()
    .default("true")
    .transform((val) => val === "true"),
};

export const clientEnvSchema = {
  // Base Configuration
  NEXT_PUBLIC_BASE_URL: url().default("http://localhost:3000"),
  NEXT_PUBLIC_SITE_URL: url().optional(),

  // Analytics & Monitoring
  NEXT_PUBLIC_GA_MEASUREMENT_ID: string().optional(),

  // Bot Protection (Cloudflare Turnstile Public Key)
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: string().optional(),
  NEXT_PUBLIC_TURNSTILE_BYPASS: string()
    .default("false")
    .transform((val) => val === "true"),

  // Development Tools
  NEXT_PUBLIC_TEST_MODE: string()
    .default("false")
    .transform((val) => val === "true"),

  // Security
  NEXT_PUBLIC_SECURITY_MODE: zEnum(["strict", "relaxed"]).default("strict"),

  // Deployment Platform
  NEXT_PUBLIC_DEPLOYMENT_PLATFORM: zEnum([
    "cloudflare",
    "development",
  ]).optional(),
};

export const runtimeEnv = {
  // Server
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  INQUIRY_RECIPIENT_EMAIL: process.env.INQUIRY_RECIPIENT_EMAIL,
  AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID,
  AIRTABLE_TABLE_NAME: process.env.AIRTABLE_TABLE_NAME,
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  TURNSTILE_ALLOWED_HOSTS: process.env.TURNSTILE_ALLOWED_HOSTS,
  TURNSTILE_BYPASS: process.env.TURNSTILE_BYPASS,
  LOG_LEVEL: process.env.LOG_LEVEL,
  DEPLOYMENT_PLATFORM: process.env.DEPLOYMENT_PLATFORM,
  GOOGLE_SITE_VERIFICATION: process.env.GOOGLE_SITE_VERIFICATION,
  BING_SITE_VERIFICATION: process.env.BING_SITE_VERIFICATION,
  RATE_LIMIT_PEPPER: process.env.RATE_LIMIT_PEPPER,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  NODE_ENV: process.env.NODE_ENV,
  APP_ENV: process.env.APP_ENV,
  CI: process.env.CI,
  SKIP_ENV_VALIDATION: process.env.SKIP_ENV_VALIDATION,
  SECURITY_HEADERS_ENABLED: process.env.SECURITY_HEADERS_ENABLED,

  // Client
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  NEXT_PUBLIC_TURNSTILE_BYPASS: process.env.NEXT_PUBLIC_TURNSTILE_BYPASS,
  NEXT_PUBLIC_TEST_MODE: process.env.NEXT_PUBLIC_TEST_MODE,
  NEXT_PUBLIC_SECURITY_MODE: process.env.NEXT_PUBLIC_SECURITY_MODE,
  NEXT_PUBLIC_DEPLOYMENT_PLATFORM: process.env.NEXT_PUBLIC_DEPLOYMENT_PLATFORM,
};

function readRawEnvValue(key: string): string | undefined {
  if (typeof process === "undefined") {
    return undefined;
  }

  return process.env[key];
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

const envSchema = { ...serverEnvSchema, ...clientEnvSchema };

// 与 createEnv 的 emptyStringAsUndefined 一致：空字符串当作未设置。
function readProcessEnvValue(key: keyof typeof env): string | undefined {
  const value = readRawEnvValue(key);
  return value === "" ? undefined : value;
}

function readValidatedEnvValue(key: keyof typeof env) {
  try {
    return env[key];
  } catch {
    return undefined;
  }
}

type RuntimeAppEnv =
  "local" | "development" | "test" | "preview" | "production";

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

/** 运行时原始值按该字段的 schema 校验，不合法时当作未设置。 */
export function getRuntimeEnvString(key: keyof typeof env): string | undefined {
  const runtimeValue = readProcessEnvValue(key);
  if (runtimeValue !== undefined) {
    const parsed = envSchema[key].safeParse(runtimeValue);
    return parsed.success && typeof parsed.data === "string"
      ? parsed.data
      : undefined;
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

export function getRuntimeAppEnv(): RuntimeAppEnv | undefined {
  return coerceRuntimeAppEnv(getRuntimeEnvString("APP_ENV"));
}

export function isRuntimeDevelopment(): boolean {
  return getRuntimeEnvString("NODE_ENV") === "development";
}

export function isRuntimeProduction(): boolean {
  return getRuntimeEnvString("NODE_ENV") === "production";
}
