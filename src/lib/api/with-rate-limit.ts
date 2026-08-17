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
  type RateLimitPreset,
} from "@/lib/security/distributed-rate-limit";
import {
  getIPKey,
  type KeyStrategy,
} from "@/lib/security/rate-limit-key-strategies";

// Re-export types for convenience
export type { RateLimitPreset } from "@/lib/security/distributed-rate-limit";
export type { KeyStrategy } from "@/lib/security/rate-limit-key-strategies";

/**
 * Context provided to rate-limited handlers
 */
export interface RateLimitContext {
  /** Client IP address used for rate limiting */
  clientIP: string;
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
 * - Storage failures return 503 so public writes fail closed
 * - Context injection with clientIP
 * - TypeScript-safe generics
 *
 * @param preset - Rate limit preset name
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
    let clientIP: string;
    let rateLimitKey: string;

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
      return createApiErrorResponse(
        API_ERROR_CODES.SERVICE_UNAVAILABLE,
        HTTP_SERVICE_UNAVAILABLE,
      );
    }

    // Rate limit exceeded or storage failure — return 429 (limit) or 503 (storage)
    if (!result.allowed) {
      const statusCode =
        result.deniedReason === "storage_failure"
          ? HTTP_SERVICE_UNAVAILABLE
          : HTTP_TOO_MANY_REQUESTS;
      return createRateLimitResponse(result, rateLimitKey, statusCode);
    }

    // Normal flow - rate limit passed
    return handler(request, { clientIP });
  };
}
