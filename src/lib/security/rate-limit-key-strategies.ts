/**
 * Rate Limit Key Generation Strategies
 *
 * HMAC-based key generation with server-side pepper to prevent
 * offline correlation attacks. All keys use minimum 64-bit (16 hex chars)
 * truncation to balance collision resistance with storage efficiency.
 *
 * The only identifier is the client IP; UserAgent is NOT used as a shard
 * (easily spoofed).
 */

import { getRuntimeEnvString, isRuntimeProduction } from "@/lib/env";
import { logger } from "@/lib/logger";
import { generateHMAC } from "@/lib/security/crypto";
import {
  integerToIpv4,
  ipv4MappedEmbeddedAddress,
  ipv4ToInteger,
  ipv6NetworkPrefix64,
} from "@/lib/security/ip-range";

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
 * @param input - The value to hash (the client IP)
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
 * 由调用方已解析好的客户端 IP 生成限流 key。
 *
 * 客户端 IP 是唯一标识，适合 NAT 误伤可接受的低流量接口。
 *
 * @param clientIP - 调用方通过 `getClientIP` 解析一次得到的客户端 IP
 * @returns Rate limit key in format `ip:{hmacHash}`
 */
export async function getIPKey(clientIP: string): Promise<string> {
  return `ip:${await hmacKey(rateLimitIpInput(clientIP))}`;
}

/**
 * Reset pepper warning state (for testing)
 */
export function resetPepperWarning(): void {
  hasLoggedPepperWarning = false;
}
