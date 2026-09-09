/**
 * Distributed Rate Limiting
 *
 * Production uses Upstash Redis; development and tests use a process-local Map.
 * Both paths perform one atomic increment per check.
 *
 * Store implementations are in ./stores/rate-limit-store.ts.
 */

import { MINUTE_MS } from "@/constants";
import { getRuntimeEnvString } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  MemoryRateLimitStore,
  RedisRateLimitStore,
} from "@/lib/security/stores/rate-limit-store";

const MAX_REQUESTS = 10;
const WINDOW_MS = MINUTE_MS;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter: number | null;
  /** Reason for denial: 'limit' = real rate limit exceeded, 'storage_failure' = backend unavailable */
  deniedReason?: "limit" | "storage_failure";
}

let rateLimitStore: MemoryRateLimitStore | RedisRateLimitStore | null = null;

function getRateLimitStore(): MemoryRateLimitStore | RedisRateLimitStore {
  if (rateLimitStore) {
    return rateLimitStore;
  }

  const upstashUrl = getRuntimeEnvString("UPSTASH_REDIS_REST_URL");
  const upstashToken = getRuntimeEnvString("UPSTASH_REDIS_REST_TOKEN");

  if (upstashUrl && upstashToken) {
    logger.info("[Rate Limit] Using Upstash Redis store");
    rateLimitStore = new RedisRateLimitStore(upstashUrl, upstashToken);
    return rateLimitStore;
  }

  if (getRuntimeEnvString("NODE_ENV") === "production") {
    throw new Error(
      "[Rate Limit] Production requires Upstash Redis. Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    );
  }

  logger.warn("[Rate Limit] Using in-memory store (development only)");
  rateLimitStore = new MemoryRateLimitStore();
  return rateLimitStore;
}

export async function checkInquiryRateLimit(
  identifier: string,
): Promise<RateLimitResult> {
  try {
    const store = getRateLimitStore();
    const entry = await store.increment(
      `ratelimit:inquiry:${identifier}`,
      WINDOW_MS,
    );
    const { count } = entry;
    const resetTime = entry.expiresAt;
    const now = Date.now();
    const remaining = Math.max(0, MAX_REQUESTS - count);
    const allowed = count <= MAX_REQUESTS;

    return {
      allowed,
      remaining,
      resetTime,
      retryAfter: allowed ? null : Math.ceil((resetTime - now) / 1000),
      ...(allowed ? {} : { deniedReason: "limit" as const }),
    };
  } catch (error) {
    logger.warn("[Rate Limit] Storage failure — fail-closed, denying request");
    logger.error("[Rate Limit] Storage backend error details", {
      error:
        error instanceof SyntaxError
          ? "Invalid rate limit JSON response"
          : error,
    });
    return {
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + WINDOW_MS,
      retryAfter: Math.ceil(WINDOW_MS / 1000),
      deniedReason: "storage_failure",
    };
  }
}

/**
 * Reset store instance (for testing)
 */
export function resetRateLimitStore(): void {
  rateLimitStore = null;
}
