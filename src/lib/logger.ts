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

const IP_V4_PATTERN = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const IP_V6_PATTERN = /^[a-fA-F0-9:]+$/;

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
  if (!ip) return "[NO_IP]";
  if (IP_V4_PATTERN.test(ip) || IP_V6_PATTERN.test(ip) || ip === "::1") {
    return "[REDACTED_IP]";
  }
  return "[REDACTED_IP]";
}

/**
 * Sanitize company name for logging
 * Returns "[REDACTED]" to prevent PII exposure
 */
function sanitizeCompany(company: string | undefined | null): string {
  if (!company) return "[NO_COMPANY]";
  return "[REDACTED]";
}

/**
 * Sanitize phone number for logging
 * Keeps first 3 chars and last 4 digits, masks middle
 */
function sanitizePhone(phone: string | undefined | null): string {
  if (!phone) return "[NO_PHONE]";
  const s = String(phone).replace(/\s/g, "");
  if (s.length <= 7) return "[PHONE]";
  return `${s.slice(0, 3)}****${s.slice(s.length - 4)}`;
}

/**
 * Sanitize log context object by replacing PII fields
 */
export function sanitizeLogContext<T extends Record<string, unknown>>(
  context: T,
): Record<string, unknown> {
  // Safe: context is internal logging data passed by application code, not user input
  const sanitized: Record<string, unknown> = { ...context };

  if ("email" in sanitized && typeof sanitized.email === "string") {
    sanitized.email = sanitizeEmail(sanitized.email);
  }
  if ("ip" in sanitized && typeof sanitized.ip === "string") {
    sanitized.ip = sanitizeIP(sanitized.ip);
  }
  if ("company" in sanitized && typeof sanitized.company === "string") {
    sanitized.company = sanitizeCompany(sanitized.company);
  }
  if ("phone" in sanitized && typeof sanitized.phone === "string") {
    sanitized.phone = sanitizePhone(sanitized.phone);
  }
  if ("from" in sanitized && typeof sanitized.from === "string") {
    sanitized.from = sanitizeEmail(sanitized.from);
  }
  if ("to" in sanitized && typeof sanitized.to === "string") {
    sanitized.to = sanitizeEmail(sanitized.to);
  }

  return sanitized;
}
