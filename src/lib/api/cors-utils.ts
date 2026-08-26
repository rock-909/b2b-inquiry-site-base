/**
 * CORS Response Utilities
 *
 * Assembles CORS headers for API routes using the allowlist-based
 * origin policy owned by lib/security/origin-policy.
 */

import { NextRequest, NextResponse } from "next/server";
import { isAllowedOrigin, isSameOrigin } from "@/lib/security/origin-policy";
import { HTTP_NO_CONTENT, HTTP_OK } from "@/constants";

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

/**
 * Get the appropriate CORS headers for a request.
 * Returns headers only if the origin is allowed.
 *
 * @param request - The incoming request
 * @returns CORS headers object or empty object if origin not allowed
 */
export function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  const sameOrigin = isSameOrigin(origin, host);
  const allowedOrigin = isAllowedOrigin(origin);

  if (!sameOrigin && !allowedOrigin) {
    return {};
  }

  const responseHeaders: Record<string, string> = {
    "Access-Control-Allow-Methods": CORS_CONFIG.allowedMethods.join(", "),
    "Access-Control-Allow-Headers": CORS_CONFIG.allowedHeaders.join(", "),
    "Access-Control-Max-Age": String(CORS_CONFIG.maxAge),
  };

  if (origin && allowedOrigin) {
    responseHeaders["Access-Control-Allow-Origin"] = origin;
  }

  return responseHeaders;
}

/**
 * Create a CORS preflight response (OPTIONS handler).
 *
 * @param request - The incoming OPTIONS request
 * @returns NextResponse with appropriate CORS headers or 204 without headers
 */
export function createCorsPreflightResponse(
  request: NextRequest,
): NextResponse {
  const corsHeaders = getCorsHeaders(request);

  if (Object.keys(corsHeaders).length === 0) {
    return new NextResponse(null, { status: HTTP_NO_CONTENT });
  }

  return new NextResponse(null, {
    status: HTTP_OK,
    headers: corsHeaders,
  });
}

/**
 * Apply CORS headers to an existing response.
 * Useful for POST responses that need CORS headers.
 *
 * @param options - Configuration options including response and request
 * @returns The response with CORS headers applied
 */
export function applyCorsHeaders(options: {
  response: NextResponse;
  request: NextRequest;
}): NextResponse {
  const { response, request } = options;

  const corsHeaders = getCorsHeaders(request);

  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}
