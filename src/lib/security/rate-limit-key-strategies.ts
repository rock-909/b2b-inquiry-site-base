/**
 * Rate Limit Key Generation Strategies
 *
 * HMAC-based key generation with server-side pepper to prevent
 * offline correlation attacks. All keys use minimum 64-bit (16 hex chars)
 * truncation to balance collision resistance with storage efficiency.
 *
 * Priority hierarchy (per security spec):
 * API key > session ID > signed token > IP
 *
 * UserAgent is NOT used as primary shard (easily spoofed).
 */

import { NextRequest } from "next/server";
import { getRuntimeEnvString, isRuntimeProduction } from "@/lib/env";
import { logger } from "@/lib/logger";
import { generateHMAC } from "@/lib/security/crypto";
import { getClientIP } from "@/lib/security/client-ip";
import {
  integerToIpv4,
  ipv4MappedEmbeddedAddress,
  ipv4ToInteger,
  ipv6NetworkPrefix64,
} from "@/lib/security/ip-range";

/** Key strategy function signature */
export type KeyStrategy = (request: NextRequest) => Promise<string> | string;

/** HMAC output length (64-bit = 16 hex chars) */
const HMAC_OUTPUT_LENGTH = 16;

/** Whether pepper warning has been logged */
let hasLoggedPepperWarning = false;

/** Minimum pepper length for security (32 bytes = 64 hex chars recommended) */
const MIN_PEPPER_LENGTH = 32;

/**
 * Get HMAC pepper from environment
 *
 * SECURITY: In production, RATE_LIMIT_PEPPER is REQUIRED. Missing or weak pepper
 * will cause fail-fast to prevent insecure rate limiting that could be bypassed.
 *
 * @throws Error in production if pepper is missing or too short
 */
function getPepper(): string {
  const currentPepper = getRuntimeEnvString("RATE_LIMIT_PEPPER");
  const isProduction = isRuntimeProduction();

  if (!currentPepper) {
    if (isProduction) {
      throw new Error(
        "[SECURITY] RATE_LIMIT_PEPPER is required in production. " +
          `Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
      );
    }

    if (!hasLoggedPepperWarning) {
      logger.warn(
        "[Rate Limit] RATE_LIMIT_PEPPER not configured. Using default development pepper. " +
          "This is insecure - set RATE_LIMIT_PEPPER for production.",
      );
      hasLoggedPepperWarning = true;
    }
    return "default-dev-pepper-insecure";
  }

  // Validate pepper length
  if (currentPepper.length < MIN_PEPPER_LENGTH) {
    if (isProduction) {
      throw new Error(
        `[SECURITY] RATE_LIMIT_PEPPER is too short (${currentPepper.length} chars). ` +
          `Minimum ${MIN_PEPPER_LENGTH} chars required. ` +
          `Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
      );
    }

    if (!hasLoggedPepperWarning) {
      logger.warn(
        `[Rate Limit] RATE_LIMIT_PEPPER is weak (${currentPepper.length} chars). ` +
          `Recommend at least ${MIN_PEPPER_LENGTH} chars for production.`,
      );
      hasLoggedPepperWarning = true;
    }
  }

  return currentPepper;
}

/**
 * Generate HMAC key from input using server-side pepper
 *
 * @param input - The value to hash (IP, session ID, API key, etc.)
 * @returns 16-character hex string (64-bit)
 */
export async function hmacKey(input: string): Promise<string> {
  const pepper = getPepper();
  const digest = await generateHMAC(input, pepper, "SHA-256");
  return digest.slice(0, HMAC_OUTPUT_LENGTH);
}

function rateLimitIpInput(ip: string): string {
  const ipv4Value = ipv4ToInteger(ip);
  if (ipv4Value !== null) {
    return integerToIpv4(ipv4Value);
  }

  const mappedIpv4 = ipv4MappedEmbeddedAddress(ip);
  if (mappedIpv4 !== null) {
    return integerToIpv4(mappedIpv4);
  }

  const prefix = ipv6NetworkPrefix64(ip);
  if (prefix === null) {
    return ip;
  }

  return `ipv6:${prefix.toString(16)}`;
}

/**
 * Strategy 1: Pure IP with HMAC (default, backward compatible)
 *
 * Uses client IP as the sole identifier. Simple and effective for
 * low-traffic APIs where NAT false positives are acceptable.
 *
 * @param request - Next.js request object
 * @returns Rate limit key in format `ip:{hmacHash}`
 */
export async function getIPKey(request: NextRequest): Promise<string> {
  const clientIP = getClientIP(request);
  return `ip:${await hmacKey(rateLimitIpInput(clientIP))}`;
}

/**
 * Reset pepper warning state (for testing)
 */
export function resetPepperWarning(): void {
  hasLoggedPepperWarning = false;
}
