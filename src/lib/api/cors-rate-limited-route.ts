import { NextRequest, type NextResponse } from "next/server";
import {
  applyCorsHeaders,
  createCorsPreflightResponse,
} from "@/lib/api/cors-utils";
import {
  withRateLimit,
  type RateLimitedHandler,
  type RateLimitPreset,
} from "@/lib/api/with-rate-limit";

/**
 * Route exports for a public write endpoint: a rate-limited, CORS-wrapped POST
 * plus the matching OPTIONS preflight handler.
 */
export interface CorsRateLimitedRoute {
  POST: (request: NextRequest) => Promise<NextResponse>;
  OPTIONS: (request: NextRequest) => NextResponse;
}

/**
 * Build the POST/OPTIONS pair for a public write route. The handler runs behind
 * the shared `withRateLimit` wrapper, its response gets CORS headers, and
 * OPTIONS answers the CORS preflight.
 *
 * @example
 * export const { POST, OPTIONS } = createCorsRateLimitedRoute(
 *   "inquiry",
 *   handleInquiryPost,
 * );
 */
export function createCorsRateLimitedRoute<T = unknown>(
  preset: RateLimitPreset,
  handler: RateLimitedHandler<T>,
): CorsRateLimitedRoute {
  const rateLimited = withRateLimit(preset, handler);

  return {
    POST: async (request: NextRequest) =>
      applyCorsHeaders({ request, response: await rateLimited(request) }),
    OPTIONS: (request: NextRequest) => createCorsPreflightResponse(request),
  };
}
