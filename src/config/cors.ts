/**
 * CORS Configuration
 *
 * Provides an allowlist-based CORS configuration that aligns with
 * Turnstile hostname validation for consistent security policy.
 *
 * Configuration priority:
 * 1. CORS_ALLOWED_ORIGINS env variable (comma-separated)
 * 2. Falls back to Turnstile allowed hosts for consistency
 */

import { getRuntimeEnvString } from "@/lib/env";
import { getAllowedTurnstileHosts } from "@/lib/security/turnstile-config";

/**
 * Parse CORS_ALLOWED_ORIGINS environment variable.
 * Returns empty array if not configured.
 */
function parseCorsEnvOrigins(): string[] {
  const origins = getRuntimeEnvString("CORS_ALLOWED_ORIGINS");
  if (!origins) return [];

  return origins.split(",").flatMap((origin) => {
    const normalized = origin.trim().toLowerCase();
    return normalized ? [normalized] : [];
  });
}

/**
 * Derive allowed origins from Turnstile hosts.
 * Converts hostnames to full origins with https protocol.
 */
function deriveOriginsFromTurnstileHosts(): string[] {
  const hosts = getAllowedTurnstileHosts();
  const origins: string[] = [];

  for (const host of hosts) {
    if (host === "localhost") {
      origins.push("http://localhost:3000");
    } else {
      origins.push(`https://${host}`);
    }
  }

  return origins;
}

/**
 * Get base URL origin from environment.
 */
function getBaseUrlOrigin(): string | null {
  const baseUrl =
    getRuntimeEnvString("NEXT_PUBLIC_SITE_URL") ??
    getRuntimeEnvString("NEXT_PUBLIC_BASE_URL");
  if (!baseUrl) return null;

  try {
    const url = new URL(baseUrl);
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Memoized allowed origins list.
 * Single source of truth for CORS and Turnstile alignment.
 */
const allowedOriginsMemo = (() => {
  const envOrigins = parseCorsEnvOrigins();
  if (envOrigins.length > 0) {
    return envOrigins;
  }

  const origins = new Set<string>();

  const baseOrigin = getBaseUrlOrigin();
  if (baseOrigin) {
    origins.add(baseOrigin);
  }

  const turnstileOrigins = deriveOriginsFromTurnstileHosts();
  for (const origin of turnstileOrigins) {
    origins.add(origin);
  }

  return Array.from(origins);
})();
const allowedOriginsSet = new Set(allowedOriginsMemo);

/**
 * Get the list of allowed CORS origins.
 */
export function getAllowedCorsOrigins(): string[] {
  return allowedOriginsMemo;
}

/**
 * Check if an origin is allowed for CORS.
 *
 * @param origin - The Origin header value from the request
 * @returns true if the origin is in the allowlist
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;

  const normalized = origin.toLowerCase();
  return allowedOriginsSet.has(normalized);
}

/**
 * Check if a request is same-origin.
 * Same-origin requests typically don't include an Origin header,
 * or the Origin matches the Host.
 *
 * @param origin - The Origin header value
 * @param host - The Host header value
 * @returns true if the request appears to be same-origin
 */
export function isSameOrigin(
  origin: string | null,
  host: string | null,
): boolean {
  if (!origin) return true;
  if (!host) return false;

  try {
    const originUrl = new URL(origin);
    const hostWithoutPort = host.split(":")[0];
    return originUrl.hostname.toLowerCase() === hostWithoutPort?.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * CORS configuration for form API endpoints.
 */
export const CORS_CONFIG = {
  /** Allowed HTTP methods for form endpoints */
  allowedMethods: ["POST", "OPTIONS"],

  /** Allowed headers for form requests */
  allowedHeaders: ["Content-Type"],

  /** Preflight cache duration in seconds (1 hour) */
  maxAge: 3600,
} as const;
