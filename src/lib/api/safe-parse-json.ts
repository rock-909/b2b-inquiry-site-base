import type { NextRequest } from "next/server";

import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { HTTP_BAD_REQUEST, HTTP_PAYLOAD_TOO_LARGE } from "@/constants";
import { logger } from "@/lib/logger";

type SafeJsonParseSuccess<T> = { ok: true; data: T };
type SafeJsonParseFailure = {
  ok: false;
  errorCode:
    | typeof API_ERROR_CODES.INVALID_JSON_BODY
    | typeof API_ERROR_CODES.PAYLOAD_TOO_LARGE;
  statusCode: typeof HTTP_BAD_REQUEST | typeof HTTP_PAYLOAD_TOO_LARGE;
};
export type SafeJsonParseResult<T> =
  SafeJsonParseSuccess<T> | SafeJsonParseFailure;

const DEFAULT_MAX_JSON_BODY_BYTES = 64 * 1024;

function createPayloadTooLargeFailure(): SafeJsonParseFailure {
  return {
    ok: false,
    errorCode: API_ERROR_CODES.PAYLOAD_TOO_LARGE,
    statusCode: HTTP_PAYLOAD_TOO_LARGE,
  };
}

function createInvalidJsonFailure(): SafeJsonParseFailure {
  return {
    ok: false,
    errorCode: API_ERROR_CODES.INVALID_JSON_BODY,
    statusCode: HTTP_BAD_REQUEST,
  };
}

function isAcceptableJsonRoot(raw: unknown): boolean {
  return raw !== null && typeof raw === "object" && !Array.isArray(raw);
}

function resolveMaxBytes(options?: { maxBytes?: number }): number {
  return typeof options?.maxBytes === "number" && options.maxBytes > 0
    ? options.maxBytes
    : DEFAULT_MAX_JSON_BODY_BYTES;
}

async function readBodyWithinLimit(
  req: NextRequest,
  route: string | undefined,
  maxBytes: number,
): Promise<string | SafeJsonParseFailure> {
  if (!req.body) {
    return "";
  }

  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        logger.warn("JSON body exceeds byte-size limit", {
          route,
          maxBytes,
        });
        await reader.cancel();
        return createPayloadTooLargeFailure();
      }

      text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

/**
 * 安全解析 JSON 请求体，统一处理解析错误和非法结构。
 *
 * - 仅当解析结果为非 null 对象且不是数组时视为成功；
 * - 解析失败或结果不是对象时，返回 { ok: false, errorCode: API_ERROR_CODES.INVALID_JSON_BODY }；
 * - 不直接决定 HTTP 状态码，由调用方根据结果返回 400 等响应；
 * - 使用统一日志格式记录解析失败，便于观察和告警。
 */
export async function safeParseJson<T>(
  req: NextRequest,
  options?: {
    /** 日志上下文中的路由标识，如 `/api/inquiry` */
    route?: string;
    /** 请求体大小上限，默认 64KB */
    maxBytes?: number;
  },
): Promise<SafeJsonParseResult<T>> {
  const maxBytes = resolveMaxBytes(options);
  const route = options?.route;
  const contentLengthHeader = req.headers.get("content-length");
  const contentLength = contentLengthHeader
    ? Number.parseInt(contentLengthHeader, 10)
    : Number.NaN;

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    logger.warn("JSON body exceeds declared content-length limit", {
      route,
      maxBytes,
      contentLength,
    });
    return createPayloadTooLargeFailure();
  }

  try {
    const rawText = await readBodyWithinLimit(req, route, maxBytes);
    if (typeof rawText !== "string") {
      return rawText;
    }

    if (!rawText.trim()) {
      return createInvalidJsonFailure();
    }

    const raw = JSON.parse(rawText) as unknown;

    if (!isAcceptableJsonRoot(raw)) {
      logger.warn("Invalid JSON structure - expected object", {
        route,
        receivedType: Array.isArray(raw) ? "array" : typeof raw,
      });
      return createInvalidJsonFailure();
    }

    return { ok: true, data: raw as T };
  } catch (error: unknown) {
    logger.warn("Failed to parse JSON body", {
      route,
      error: error instanceof Error ? error.message : String(error),
    });

    return createInvalidJsonFailure();
  }
}
