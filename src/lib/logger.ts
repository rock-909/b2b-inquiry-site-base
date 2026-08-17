/* eslint-disable no-console -- logger intentionally wraps console.* with browser-safe env filtering */
/**
 * Browser-safe logger facade.
 */

type LogArgs = [message?: unknown, ...optionalParams: unknown[]];
type LogLevel = "error" | "warn" | "info" | "debug";

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function isDev(): boolean {
  return (
    process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test"
  );
}

function isValidLogLevel(value: string): value is LogLevel {
  return Object.prototype.hasOwnProperty.call(LOG_LEVELS, value);
}

function getLogLevel(): LogLevel {
  const rawLevel = process.env.NEXT_PUBLIC_LOG_LEVEL ?? process.env.LOG_LEVEL;
  const level = rawLevel?.toLowerCase() as LogLevel | undefined;
  if (level && isValidLogLevel(level)) {
    return level;
  }
  return isDev() ? "debug" : "warn";
}

function shouldLog(level: LogLevel): boolean {
  if (level === "error" || level === "warn") {
    return true;
  }
  if (level === "debug" && !isDev()) {
    return false;
  }
  return LOG_LEVELS[level] <= LOG_LEVELS[getLogLevel()];
}

export const logger = {
  debug: (...args: LogArgs) => {
    if (shouldLog("debug")) {
      console.debug(...args);
    }
  },
  info: (...args: LogArgs) => {
    if (shouldLog("info")) {
      console.info(...args);
    }
  },
  log: (...args: LogArgs) => {
    if (shouldLog("debug")) {
      console.log(...args);
    }
  },
  warn: (...args: LogArgs) => {
    if (shouldLog("warn")) {
      console.warn(...args);
    }
  },
  error: (...args: LogArgs) => {
    if (shouldLog("error")) {
      console.error(...args);
    }
  },
};

/**
 * @public Logger facade contract for downstream integrations.
 */
export type Logger = typeof logger;

/**
 * PII sanitization utilities for production logging
 * Replaces sensitive data with safe identifiers
 */

/**
 * Sanitize email for logging - fully redacts to avoid PII leakage
 * Returns "[REDACTED_EMAIL]" for any provided value
 */
export function sanitizeEmail(email: string | undefined | null): string {
  if (!email) return "[NO_EMAIL]";
  return "[REDACTED_EMAIL]";
}

/**
 * Sanitize IP address for logging
 * Returns "[REDACTED_IP]" to prevent tracking
 */
export function sanitizeIP(ip: string | undefined | null): string {
  return ip ? "[REDACTED_IP]" : "[NO_IP]";
}
