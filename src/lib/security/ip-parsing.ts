import { ipv4ToInteger, ipv6ToBigInt } from "@/lib/security/ip-range";

const INVALID_IP_VERSION = 0;
const IPV4_VERSION = 4;
const IPV6_VERSION = 6;
const CHAR_CODE_0 = 48;
const CHAR_CODE_9 = 57;

function isNumericPort(value: string): boolean {
  if (value.length === 0) {
    return false;
  }

  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < CHAR_CODE_0 || code > CHAR_CODE_9) {
      return false;
    }
  }

  return true;
}

/**
 * Strip port from IP address if present.
 */
export function stripPort(ip: string): string {
  if (ip[0] === "[") {
    const bracketEnd = ip.indexOf("]");
    if (bracketEnd <= 1) {
      return ip;
    }

    const wrappedHost = ip.slice(1, bracketEnd);
    const suffix = ip.slice(bracketEnd + 1);

    if (suffix === "") {
      return wrappedHost;
    }

    if (suffix[0] !== ":") {
      return ip;
    }

    return isNumericPort(suffix.slice(1)) ? wrappedHost : ip;
  }

  const firstColon = ip.indexOf(":");
  if (firstColon !== -1 && firstColon === ip.lastIndexOf(":")) {
    return ip.slice(0, firstColon);
  }

  return ip;
}

/**
 * Parse first IP from X-Forwarded-For style headers.
 */
export function parseFirstIP(headerValue: string): string {
  const firstIP = headerValue.split(",", 1).at(0)!;
  return stripPort(firstIP.trim());
}

export function getIPVersion(ip: string): number {
  if (ipv4ToInteger(ip) !== null) return IPV4_VERSION;
  if (ipv6ToBigInt(ip) !== null) return IPV6_VERSION;
  return INVALID_IP_VERSION;
}

/**
 * Validate IP address with local normalization rules.
 */
export function isValidIP(ip: string): boolean {
  const cleanIP = stripPort(ip.trim());
  return getIPVersion(cleanIP) !== INVALID_IP_VERSION;
}
