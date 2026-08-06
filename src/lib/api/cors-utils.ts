/**
 * CORS Response Utilities
 *
 * Provides helper functions for handling CORS in API routes
 * using the allowlist-based configuration.
 */

import { NextRequest, NextResponse } from "next/server";
import { CORS_CONFIG, isAllowedOrigin, isSameOrigin } from "@/config/cors";
import { HTTP_NO_CONTENT, HTTP_OK } from "@/constants";

interface CorsOptions {
  additionalMethods?: string[];
  additionalHeaders?: string[];
}

/**
 * Get the appropriate CORS headers for a request.
 * Returns headers only if the origin is allowed.
 *
 * @param request - The incoming request
 * @param options - Additional CORS configuration options
 * @returns CORS headers object or empty object if origin not allowed
 */
export function getCorsHeaders(
  request: NextRequest,
  options: CorsOptions = {},
): Record<string, string> {
  const { additionalMethods = [], additionalHeaders = [] } = options;
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  const sameOrigin = isSameOrigin(origin, host);
  const allowedOrigin = isAllowedOrigin(origin);

  if (!sameOrigin && !allowedOrigin) {
    return {};
  }

  const methods = [...CORS_CONFIG.allowedMethods, ...additionalMethods];
  const headers = [...CORS_CONFIG.allowedHeaders, ...additionalHeaders];

  const responseHeaders: Record<string, string> = {
    "Access-Control-Allow-Methods": methods.join(", "),
    "Access-Control-Allow-Headers": headers.join(", "),
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
 * @param additionalMethods - Additional methods to allow
 * @param additionalHeaders - Additional headers to allow
 * @returns NextResponse with appropriate CORS headers or 204 without headers
 */
export function createCorsPreflightResponse(
  request: NextRequest,
  additionalMethods: string[] = [],
  additionalHeaders: string[] = [],
): NextResponse {
  const corsHeaders = getCorsHeaders(request, {
    additionalMethods,
    additionalHeaders,
  });

  if (Object.keys(corsHeaders).length === 0) {
    return new NextResponse(null, { status: HTTP_NO_CONTENT });
  }

  return new NextResponse(null, {
    status: HTTP_OK,
    headers: corsHeaders,
  });
}

interface ApplyCorsOptions extends CorsOptions {
  response: NextResponse;
  request: NextRequest;
}

/**
 * Apply CORS headers to an existing response.
 * Useful for POST/GET responses that need CORS headers.
 *
 * @param options - Configuration options including response and request
 * @returns The response with CORS headers applied
 */
export function applyCorsHeaders(options: ApplyCorsOptions): NextResponse {
  const { response, request, additionalMethods, additionalHeaders } = options;

  const corsOptions: CorsOptions = {};
  if (additionalMethods) corsOptions.additionalMethods = additionalMethods;
  if (additionalHeaders) corsOptions.additionalHeaders = additionalHeaders;

  const corsHeaders = getCorsHeaders(request, corsOptions);

  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}
