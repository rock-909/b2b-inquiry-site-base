/**
 * Rate Limit Higher-Order Function
 *
 * Eliminates rate limiting boilerplate from API routes by wrapping handlers
 * with consistent rate limit checking, error responses, and context injection.
 *
 * @example
 * ```typescript
 * // Basic usage with default IP-based key
 * export const POST = withRateLimit('inquiry', async (req, { clientIP }) => {
 *   // Handler logic - clientIP already extracted
 *   return NextResponse.json({ success: true });
 * });
 *
 * // With custom key strategy
 * export const POST = withRateLimit(
 *   'csp',
 *   async (req, { clientIP }) => { ... },
 *   getIPKey
 * );
 * ```
 */

import { NextRequest, NextResponse } from "next/server";
import { HTTP_SERVICE_UNAVAILABLE, HTTP_TOO_MANY_REQUESTS } from "@/constants";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import {
  createApiErrorResponse,
  type ApiErrorResponse,
} from "@/lib/api/api-response";
import { logger } from "@/lib/logger";
import { getClientIP as getTrustedClientIP } from "@/lib/security/client-ip";
import {
  checkDistributedRateLimit,
  createRateLimitHeaders,
  RATE_LIMIT_PRESETS,
  type RateLimitPreset,
} from "@/lib/security/distributed-rate-limit";
import {
  getIPKey,
  type KeyStrategy,
} from "@/lib/security/rate-limit-key-strategies";

// Re-export types for convenience
export type { RateLimitPreset } from "@/lib/security/distributed-rate-limit";
export type { KeyStrategy } from "@/lib/security/rate-limit-key-strategies";

/** Header for degraded mode indication */
const RATE_LIMIT_DEGRADED_HEADER = "X-RateLimit-Degraded";
const FALLBACK_CLIENT_IP = "0.0.0.0";

/**
 * Storage failure tracking for alert threshold
 * Track failures within a sliding window to trigger alerts
 */
interface FailureTracker {
  count: number;
  windowStart: number;
}

const ALERT_THRESHOLD = 3;
const ALERT_WINDOW_MS = 60000; // 1 minute
let storageFailureTracker: FailureTracker = {
  count: 0,
  windowStart: Date.now(),
};

/**
 * Context provided to rate-limited handlers
 */
export interface RateLimitContext {
  /** Client IP address used for rate limiting */
  clientIP: string;
  /** Whether rate limiting is in degraded mode (storage failure) */
  degraded?: boolean;
}

/**
 * Rate-limited handler function signature
 * Supports both sync and async handlers for flexibility
 */
export type RateLimitedHandler<T = unknown> = (
  request: NextRequest,
  context: RateLimitContext,
) => Promise<NextResponse<T>> | NextResponse<T>;

/**
 * Track storage failure and check if alert threshold exceeded
 */
function trackStorageFailure(): boolean {
  const now = Date.now();

  // Reset window if expired
  if (now - storageFailureTracker.windowStart > ALERT_WINDOW_MS) {
    storageFailureTracker = { count: 1, windowStart: now };
    return false;
  }

  storageFailureTracker.count += 1;
  return storageFailureTracker.count > ALERT_THRESHOLD;
}

/**
 * Handle a request that was allowed in degraded (storage-failure) mode.
 * Tracks the failure, emits an alert when the threshold is exceeded,
 * and adds the X-RateLimit-Degraded header to the handler response.
 */
async function handleDegradedRequest<T>({
  request,
  handler,
  clientIP,
  preset,
}: {
  request: NextRequest;
  handler: RateLimitedHandler<T>;
  clientIP: string;
  preset: RateLimitPreset;
}): Promise<NextResponse<T>> {
  const shouldAlert = trackStorageFailure();

  logger.warn("Rate limit storage degraded (fail-open)", {
    preset,
    alertTriggered: shouldAlert,
  });

  if (shouldAlert) {
    logger.error("ALERT: Rate limit storage failure threshold exceeded", {
      failureCount: storageFailureTracker.count,
      windowMs: ALERT_WINDOW_MS,
    });
  }

  const response = await handler(request, { clientIP, degraded: true });
  response.headers.set(RATE_LIMIT_DEGRADED_HEADER, "true");
  return response;
}

/**
 * Create rate limit exceeded response
 */
function createRateLimitResponse(
  result: Awaited<ReturnType<typeof checkDistributedRateLimit>>,
  keyPrefix: string,
  statusCode: number = HTTP_TOO_MANY_REQUESTS,
): NextResponse<ApiErrorResponse> {
  const headers = createRateLimitHeaders(result);

  // Log only safe prefix (max 8 chars) per privacy requirements
  logger.warn("Rate limit exceeded", {
    keyPrefix: keyPrefix.slice(0, 8),
    retryAfter: result.retryAfter,
    deniedReason: result.deniedReason,
  });

  const response = createApiErrorResponse(
    result.deniedReason === "storage_failure"
      ? API_ERROR_CODES.SERVICE_UNAVAILABLE
      : API_ERROR_CODES.RATE_LIMIT_EXCEEDED,
    statusCode,
  );
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}

/**
 * Higher-order function that wraps API handlers with rate limiting
 *
 * Features:
 * - Eliminates 10-15 lines of boilerplate per route
 * - Consistent 429/503 responses with proper headers
 * - Storage failure behavior determined by preset `failureMode`:
 *   'open' allows traffic with degraded header; 'closed' returns 503
 * - Context injection with clientIP
 * - TypeScript-safe generics
 *
 * @param preset - Rate limit preset name (e.g., 'inquiry', 'csp')
 * @param handler - The actual request handler function
 * @param keyStrategy - Optional custom key generation strategy (defaults to IP-based)
 * @returns Wrapped handler function compatible with Next.js route exports
 *
 * @example
 * ```typescript
 * // In src/app/api/inquiry/route.ts
 * export const POST = withRateLimit('inquiry', async (req, { clientIP }) => {
 *   const body = await req.json();
 *   // ... handler logic
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function withRateLimit<T = unknown>(
  preset: RateLimitPreset,
  handler: RateLimitedHandler<T>,
  keyStrategy: KeyStrategy = getIPKey,
): (request: NextRequest) => Promise<NextResponse<T | ApiErrorResponse>> {
  return async (
    request: NextRequest,
  ): Promise<NextResponse<T | ApiErrorResponse>> => {
    let clientIP = FALLBACK_CLIENT_IP;
    let rateLimitKey = "";

    // Defensive catch: checkDistributedRateLimit is designed to always resolve,
    // but guard against unexpected rejections (e.g. store factory exceptions).
    let result: Awaited<ReturnType<typeof checkDistributedRateLimit>>;
    try {
      clientIP = getTrustedClientIP(request);
      rateLimitKey = await keyStrategy(request);
      result = await checkDistributedRateLimit(rateLimitKey, preset);
    } catch (error) {
      logger.error("Unexpected rate limit infrastructure failure", {
        preset,
        error,
      });
      const failClosed = RATE_LIMIT_PRESETS[preset].failureMode === "closed";
      if (failClosed) {
        return createApiErrorResponse(
          API_ERROR_CODES.SERVICE_UNAVAILABLE,
          HTTP_SERVICE_UNAVAILABLE,
        );
      }
      result = {
        allowed: true,
        remaining: 0,
        resetTime: Date.now() + RATE_LIMIT_PRESETS[preset].windowMs,
        retryAfter: null,
        degraded: true,
      };
    }

    // Rate limit exceeded or storage failure — return 429 (limit) or 503 (storage)
    if (!result.allowed) {
      const statusCode =
        result.deniedReason === "storage_failure"
          ? HTTP_SERVICE_UNAVAILABLE
          : HTTP_TOO_MANY_REQUESTS;
      return createRateLimitResponse(result, rateLimitKey, statusCode);
    }

    // Storage failure triggered fail-open - track, alert, and add degraded header
    if (result.degraded) {
      return handleDegradedRequest({ request, handler, clientIP, preset });
    }

    // Normal flow - rate limit passed
    return handler(request, { clientIP });
  };
}

/**
 * Reset storage failure tracker (for testing)
 */
export function resetStorageFailureTracker(): void {
  storageFailureTracker = { count: 0, windowStart: Date.now() };
}
