/**
 * Distributed Rate Limiting
 *
 * Provides single-instance rate limiting backed by a pluggable store. Store
 * increments are atomic (Redis INCR is server-atomic; the in-memory store is
 * synchronous), so a single `increment` call per check is race-free without any
 * process-local serialization. Cross-instance consistency requires a
 * distributed store backend (Upstash Redis / KV); without one, limits are
 * best-effort per-instance only.
 *
 * Store implementations are in ./stores/rate-limit-store.ts.
 */

import { logger } from "@/lib/logger";
import { MINUTE_MS } from "@/constants";
import {
  type RateLimitStore,
  createRateLimitStore,
  resetRateLimitStoreWarnings,
} from "@/lib/security/stores/rate-limit-store";

// Rate limit configuration per endpoint
// failureMode: "open" = allow on storage failure; "closed" = deny on storage failure
export const RATE_LIMIT_PRESETS = {
  inquiry: {
    maxRequests: 10,
    windowMs: MINUTE_MS,
    failureMode: "closed" as const,
  },
  csp: { maxRequests: 100, windowMs: MINUTE_MS, failureMode: "open" as const },
} as const;

export type RateLimitPreset = keyof typeof RATE_LIMIT_PRESETS;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter: number | null;
  /** Indicates storage failure triggered fail-open or fail-closed behavior */
  degraded?: boolean;
  /** Reason for denial: 'limit' = real rate limit exceeded, 'storage_failure' = backend unavailable */
  deniedReason?: "limit" | "storage_failure";
}

let rateLimitStore: RateLimitStore | null = null;

function getRateLimitStore(): RateLimitStore {
  if (!rateLimitStore) {
    rateLimitStore = createRateLimitStore();
  }
  return rateLimitStore;
}

/**
 * Get rate limit config for preset (safe access pattern)
 */
function getRateLimitConfig(preset: RateLimitPreset): {
  maxRequests: number;
  windowMs: number;
  failureMode: "open" | "closed";
} {
  return RATE_LIMIT_PRESETS[preset];
}

async function executeRateLimitCheck(
  key: string,
  config: ReturnType<typeof getRateLimitConfig>,
): Promise<RateLimitResult> {
  try {
    // getRateLimitStore inside try so any constructor/factory failure
    // is caught and handled by the failureMode logic below. The store owns its
    // own network timeout (Redis fetch AbortController), so no extra timeout
    // wrapper is needed here.
    const store = getRateLimitStore();
    const entry = await store.increment(key, config.windowMs);
    const { count } = entry;
    const resetTime = entry.expiresAt;
    const now = Date.now();
    const remaining = Math.max(0, config.maxRequests - count);
    const allowed = count <= config.maxRequests;

    return {
      allowed,
      remaining,
      resetTime,
      retryAfter: allowed ? null : Math.ceil((resetTime - now) / 1000),
      ...(allowed ? {} : { deniedReason: "limit" as const }),
    };
  } catch (error) {
    const failClosed = config.failureMode === "closed";
    logger.warn(
      failClosed
        ? "[Rate Limit] Storage failure — fail-closed, denying request (degraded)"
        : "[Rate Limit] Storage failure — fail-open, allowing request (degraded)",
    );
    logger.error("[Rate Limit] Storage backend error details", { error });
    return {
      allowed: !failClosed,
      remaining: failClosed ? 0 : config.maxRequests - 1,
      resetTime: Date.now() + config.windowMs,
      retryAfter: failClosed ? Math.ceil(config.windowMs / 1000) : null,
      degraded: true,
      ...(failClosed ? { deniedReason: "storage_failure" as const } : {}),
    };
  }
}

/**
 * Check rate limit for a given identifier and preset.
 *
 * Performs exactly one atomic store increment per call, so no process-local
 * serialization is required.
 */
export function checkDistributedRateLimit(
  identifier: string,
  preset: RateLimitPreset,
): Promise<RateLimitResult> {
  const config = getRateLimitConfig(preset);
  const key = `ratelimit:${preset}:${identifier}`;
  return executeRateLimitCheck(key, config);
}

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers();
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set("X-RateLimit-Reset", String(result.resetTime));

  if (result.retryAfter !== null) {
    headers.set("Retry-After", String(result.retryAfter));
  }

  return headers;
}

/**
 * Reset store instance (for testing)
 */
export function resetRateLimitStore(): void {
  rateLimitStore = null;
  resetRateLimitStoreWarnings();
}
