/**
 * Client-safe public runtime env reads (zod-free, allowlist only).
 *
 * Client Components must import from here — never from `@/lib/env`.
 */

const PUBLIC_RUNTIME_ENV_READERS = {
  NODE_ENV: () => process.env.NODE_ENV,
  NEXT_PUBLIC_APP_ENV: () => process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_BASE_URL: () => process.env.NEXT_PUBLIC_BASE_URL,
  NEXT_PUBLIC_SITE_URL: () => process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_APP_NAME: () => process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_VERSION: () => process.env.NEXT_PUBLIC_APP_VERSION,
  NEXT_PUBLIC_SITE_KEY: () => process.env.NEXT_PUBLIC_SITE_KEY,
  NEXT_PUBLIC_GA_MEASUREMENT_ID: () =>
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: () =>
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  NEXT_PUBLIC_TURNSTILE_BYPASS: () => process.env.NEXT_PUBLIC_TURNSTILE_BYPASS,
  NEXT_PUBLIC_TEST_MODE: () => process.env.NEXT_PUBLIC_TEST_MODE,
  NEXT_PUBLIC_DEFAULT_LOCALE: () => process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  NEXT_PUBLIC_SUPPORTED_LOCALES: () =>
    process.env.NEXT_PUBLIC_SUPPORTED_LOCALES,
  NEXT_PUBLIC_SECURITY_MODE: () => process.env.NEXT_PUBLIC_SECURITY_MODE,
  NEXT_PUBLIC_DEPLOYMENT_PLATFORM: () =>
    process.env.NEXT_PUBLIC_DEPLOYMENT_PLATFORM,
} as const satisfies Record<string, () => string | undefined>;

export type PublicRuntimeEnvKey = keyof typeof PUBLIC_RUNTIME_ENV_READERS;

function assertAllowlistedKey(key: PublicRuntimeEnvKey): void {
  if (!(key in PUBLIC_RUNTIME_ENV_READERS)) {
    throw new Error(
      `Environment key "${key}" is not on the public runtime allowlist`,
    );
  }
}

export function getPublicRuntimeEnvString(
  key: PublicRuntimeEnvKey,
): string | undefined {
  assertAllowlistedKey(key);
  return PUBLIC_RUNTIME_ENV_READERS[key]();
}

export function getPublicRuntimeEnvBoolean(
  key: PublicRuntimeEnvKey,
): boolean | undefined {
  const value = getPublicRuntimeEnvString(key);

  if (value === undefined) {
    return undefined;
  }

  return value === "true";
}

export function isPublicRuntimeDevelopment(): boolean {
  return getPublicRuntimeEnvString("NODE_ENV") === "development";
}

export function isPublicRuntimeProduction(): boolean {
  return getPublicRuntimeEnvString("NODE_ENV") === "production";
}
