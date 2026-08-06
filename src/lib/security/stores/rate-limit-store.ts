import { getRuntimeEnvString } from "@/lib/env";
import { logger } from "@/lib/logger";

/** 导出是为了让客户端提交预算的测试能跟它对账，而不是手抄一个数。 */
export const UPSTASH_OPERATION_TIMEOUT_MS = 5_000;

/**
 * Key-value pair interface representing rate limit data
 */
interface RateLimitEntry {
  count: number;
  expiresAt: number; // Unix timestamp in milliseconds
}

/**
 * Interface for rate limit storage implementations
 */
export interface RateLimitStore {
  /**
   * Increment the counter for a key and return the new count
   * @param key - The rate limit key (e.g., IP address)
   * @param windowMs - Window size in milliseconds
   * @returns The new count after increment
   */
  increment(key: string, windowMs: number): Promise<RateLimitEntry>;

  /**
   * Get the current count for a key
   */
  get(key: string): Promise<RateLimitEntry | null>;

  /**
   * Delete a key
   */
  delete(key: string): Promise<void>;
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

  return [];
}

function getStrictUpstashPipelineResults(payload: unknown): unknown[] {
  const results = getUpstashPipelineResults(payload);
  if (results.length === 0) {
    throw new Error(
      "[Rate Limit] Invalid Upstash response: expected multi-exec results",
    );
  }
  return results;
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

function parseLenientTTL(value: unknown): number {
  const parsed = Number(unwrapUpstashResult(value));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

/**
 * Redis-backed rate limit store using Upstash REST API
 */
class RedisRateLimitStore implements RateLimitStore {
  private url: string;
  private token: string;

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
      const results = getStrictUpstashPipelineResults(data);
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

  async get(key: string): Promise<RateLimitEntry | null> {
    const operation = await this.fetchUpstash(`${this.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["GET", key],
        ["PTTL", key],
      ]),
    });
    const { response } = operation;

    try {
      if (!response.ok) {
        throw new Error(
          `[Rate Limit] Upstash get failed: ${response.statusText}`,
        );
      }

      const data = await response.json();
      const results = getUpstashPipelineResults(data);
      if (results.length < 2) {
        return null;
      }
      const [countResult, ttlResult] = results;
      const rawCount = unwrapUpstashResult(countResult);
      if (rawCount === null || rawCount === undefined) {
        return null;
      }
      const count = parseInt(String(rawCount), 10);
      if (Number.isNaN(count)) {
        throw new Error(
          "[Rate Limit] Invalid Upstash response: expected numeric count",
        );
      }
      const ttlMs = parseLenientTTL(ttlResult);
      const expiresAt = Date.now() + ttlMs;
      return { count, expiresAt };
    } finally {
      operation.clearTimeout();
    }
  }

  async delete(key: string): Promise<void> {
    const operation = await this.fetchUpstash(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["DEL", key]),
    });
    const { response } = operation;

    try {
      if (!response.ok) {
        logger.error(
          `[Rate Limit] Failed to delete rate limit key: ${response.statusText}`,
        );
      }
    } finally {
      operation.clearTimeout();
    }
  }
}

/**
 * In-memory rate limit store (for development/testing only)
 */
class MemoryRateLimitStore implements RateLimitStore {
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

  get(key: string): Promise<RateLimitEntry | null> {
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      if (entry) {
        this.store.delete(key);
      }
      return Promise.resolve(null);
    }
    return Promise.resolve(entry);
  }

  delete(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }
}

let memoryStoreWarningLogged = false;

export function resetRateLimitStoreWarnings(): void {
  memoryStoreWarningLogged = false;
}

export { MemoryRateLimitStore, RedisRateLimitStore };

/**
 * Factory function to create the appropriate rate limit store
 * Production requires Upstash Redis; development can use in-memory fallback
 */
export function createRateLimitStore(): RateLimitStore {
  const upstashUrl = getRuntimeEnvString("UPSTASH_REDIS_REST_URL");
  const upstashToken = getRuntimeEnvString("UPSTASH_REDIS_REST_TOKEN");

  if (upstashUrl && upstashToken) {
    logger.info("[Rate Limit] Using Upstash Redis store");
    return new RedisRateLimitStore(upstashUrl, upstashToken);
  }

  const isProduction = getRuntimeEnvString("NODE_ENV") === "production";

  if (isProduction) {
    throw new Error(
      "[Rate Limit] Production requires Upstash Redis. Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    );
  }

  if (!memoryStoreWarningLogged) {
    logger.warn("[Rate Limit] Using in-memory store (development only)");
    memoryStoreWarningLogged = true;
  }
  return new MemoryRateLimitStore();
}
