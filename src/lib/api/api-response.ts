/**
 * Unified API Response Utilities
 *
 * Provides standardized functions for creating success and error responses
 * across all API routes.
 */

import { NextResponse } from "next/server";

import { type ApiErrorCode } from "@/constants/api-error-codes";
import { HTTP_OK } from "@/constants";

/**
 * Standard API error response structure
 */
export interface ApiErrorResponse {
  success: false;
  errorCode: ApiErrorCode;
  details?: string[];
}

export interface ApiErrorResponseOptions {
  details?: string[];
}

/**
 * Standard API success response structure
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * @public Union type for standardized API responses.
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Create a standardized error response
 *
 * @param errorCode - The API error code from API_ERROR_CODES
 * @param status - HTTP status code
 * @returns NextResponse with standardized error format
 *
 * @example
 * ```ts
 * import { createApiErrorResponse } from '@/lib/api/api-response';
 * import { API_ERROR_CODES } from '@/constants/api-error-codes';
 * import { HTTP_BAD_REQUEST } from '@/constants';
 *
 * return createApiErrorResponse(API_ERROR_CODES.INVALID_JSON_BODY, HTTP_BAD_REQUEST);
 * ```
 */
function createApiErrorBody(
  errorCode: ApiErrorCode,
  options?: ApiErrorResponseOptions,
): ApiErrorResponse {
  const body: ApiErrorResponse = { success: false, errorCode };

  if (options?.details && options.details.length > 0) {
    body.details = options.details;
  }

  return body;
}

export function createApiErrorResponse(
  errorCode: ApiErrorCode,
  status: number,
  options?: ApiErrorResponseOptions,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(createApiErrorBody(errorCode, options), { status });
}

/**
 * Create a standardized success response
 *
 * @param data - The response payload
 * @param status - HTTP status code (defaults to 200)
 * @returns NextResponse with standardized success format
 *
 * @example
 * ```ts
 * import { createApiSuccessResponse } from '@/lib/api/api-response';
 *
 * return createApiSuccessResponse({ email: 'user@example.com', referenceId: '123' });
 * ```
 */
export function createApiSuccessResponse<T>(
  data: T,
  status: number = HTTP_OK,
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}
