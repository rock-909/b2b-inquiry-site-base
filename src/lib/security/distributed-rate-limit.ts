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

// Public inquiry writes fail closed when the shared store is unavailable.
export const RATE_LIMIT_PRESETS = {
  inquiry: {
    maxRequests: 10,
    windowMs: MINUTE_MS,
  },
} as const;

export type RateLimitPreset = keyof typeof RATE_LIMIT_PRESETS;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter: number | null;
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

type RateLimitConfig = {
  maxRequests: number;
  windowMs: number;
};

async function executeRateLimitCheck(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  try {
    // getRateLimitStore inside try so any constructor/factory failure
    // is caught and denied below. The store owns its
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
    logger.warn("[Rate Limit] Storage failure — fail-closed, denying request");
    logger.error("[Rate Limit] Storage backend error details", { error });
    return {
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + config.windowMs,
      retryAfter: Math.ceil(config.windowMs / 1000),
      deniedReason: "storage_failure",
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
  const config = RATE_LIMIT_PRESETS[preset];
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
