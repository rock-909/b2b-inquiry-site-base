import { logger } from "@/lib/logger";

/** 导出是为了让客户端提交预算的测试能跟它对账，而不是手抄一个数。 */
export const UPSTASH_OPERATION_TIMEOUT_MS = 2_000;

/**
 * Key-value pair interface representing rate limit data
 */
interface RateLimitEntry {
  count: number;
  expiresAt: number; // Unix timestamp in milliseconds
}

type UpstashResultEnvelope = { result: unknown };

interface UpstashFetchOperation {
  response: Response;
  clearTimeout: () => void;
}

function hasUpstashResultProperty(
  value: unknown,
): value is UpstashResultEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.hasOwn(value, "result")
  );
}

function unwrapUpstashResult(value: unknown): unknown {
  return hasUpstashResultProperty(value) ? value.result : value;
}

function getUpstashPipelineResults(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (hasUpstashResultProperty(payload) && Array.isArray(payload.result)) {
    return payload.result;
  }

  throw new Error(
    "[Rate Limit] Invalid Upstash response: expected multi-exec results",
  );
}

function parseStrictNumber(value: unknown, label: string): number {
  const parsed = unwrapUpstashResult(value);
  if (!Number.isFinite(parsed as number)) {
    throw new Error(
      `[Rate Limit] Invalid Upstash response: expected numeric ${label}`,
    );
  }
  return parsed as number;
}

/**
 * Redis-backed rate limit store using Upstash REST API
 */
export class RedisRateLimitStore {
  private readonly url: string;
  private readonly token: string;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  private async fetchUpstash(
    input: string,
    init: RequestInit,
  ): Promise<UpstashFetchOperation> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      UPSTASH_OPERATION_TIMEOUT_MS,
    );

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      return {
        response,
        clearTimeout: () => clearTimeout(timeout),
      };
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    const operation = await this.fetchUpstash(`${this.url}/multi-exec`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["PEXPIRE", key, windowMs.toString(), "NX"],
        ["PTTL", key],
      ]),
    });
    const { response } = operation;

    try {
      if (!response.ok) {
        logger.error(
          `[Rate Limit] Upstash pipeline failed: ${response.statusText}`,
        );
        throw new Error(
          `Upstash rate limit operation failed: ${response.status}`,
        );
      }

      const data = await response.json();
      const results = getUpstashPipelineResults(data);
      if (results.length < 3) {
        throw new Error(
          "[Rate Limit] Invalid Upstash response: expected multi-exec results",
        );
      }
      const [countResult, _expireResult, ttlResult] = results;
      const count = parseStrictNumber(countResult, "count");
      const ttlMs = Number(unwrapUpstashResult(ttlResult));

      if (!Number.isFinite(ttlMs) || ttlMs < 0) {
        logger.error("[Rate Limit] Upstash transaction returned invalid TTL");
        throw new Error("Upstash rate limit operation returned invalid TTL");
      }

      const expiresAt = Date.now() + ttlMs;
      return { count, expiresAt };
    } finally {
      operation.clearTimeout();
    }
  }
}

/**
 * In-memory rate limit store (for development/testing only)
 */
export class MemoryRateLimitStore {
  private store = new Map<string, RateLimitEntry>();

  increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    const now = Date.now();
    const expiresAt = now + windowMs;

    const entry = this.store.get(key);
    if (entry && entry.expiresAt > now) {
      entry.count += 1;
      return Promise.resolve({
        count: entry.count,
        expiresAt: entry.expiresAt,
      });
    }

    const newEntry = { count: 1, expiresAt };
    this.store.set(key, newEntry);
    return Promise.resolve(newEntry);
  }
}
