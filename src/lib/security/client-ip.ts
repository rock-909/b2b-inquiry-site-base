/**
 * Trusted Proxy Model - Client IP Extraction
 *
 * Extracts client IP from request headers with platform-specific trust rules.
 * Only parses proxy headers when request comes from a trusted platform entry.
 */

import { NextRequest } from "next/server";
import { getRuntimeEnvString, isRuntimeDevelopment } from "@/lib/env";
import { isValidIP, parseFirstIP } from "@/lib/security/ip-parsing";

const PLATFORM_CLOUDFLARE = "cloudflare";
const PLATFORM_DEVELOPMENT = "development";

type DeploymentPlatform =
  typeof PLATFORM_CLOUDFLARE | typeof PLATFORM_DEVELOPMENT;

type HeadersLike = Pick<Headers, "get">;
type TrustedHeaderName = "x-real-ip" | "x-forwarded-for" | "cf-connecting-ip";

interface TrustedProxyConfig {
  primaryHeader: TrustedHeaderName;
  secondaryHeader?: TrustedHeaderName;
}

const FALLBACK_IP = "0.0.0.0";
const LOCALHOST_IP = "127.0.0.1";

const CLOUDFLARE_TRUSTED_PROXY_CONFIG: TrustedProxyConfig = {
  primaryHeader: "cf-connecting-ip",
};

const DEVELOPMENT_TRUSTED_PROXY_CONFIG: TrustedProxyConfig = {
  primaryHeader: "x-forwarded-for",
  secondaryHeader: "x-real-ip",
};

function getDeploymentPlatform(): DeploymentPlatform | null {
  const platform = getRuntimeEnvString("DEPLOYMENT_PLATFORM");

  if (platform) {
    const normalizedPlatform = platform.toLowerCase();
    if (normalizedPlatform === PLATFORM_CLOUDFLARE) return PLATFORM_CLOUDFLARE;
    if (normalizedPlatform === PLATFORM_DEVELOPMENT) {
      return PLATFORM_DEVELOPMENT;
    }
    return null;
  }

  if (getRuntimeEnvString("CF_PAGES")) {
    return PLATFORM_CLOUDFLARE;
  }
  if (isRuntimeDevelopment()) {
    return PLATFORM_DEVELOPMENT;
  }

  return null;
}

function readHeaderIP(
  headers: HeadersLike,
  headerName: TrustedHeaderName,
): string | null {
  const headerValue = headers.get(headerName);
  if (!headerValue) {
    return null;
  }

  const ip = parseFirstIP(headerValue);
  return isValidIP(ip) ? ip : null;
}

function readTrustedHeaderIP(
  headers: HeadersLike,
  config: TrustedProxyConfig,
): string | null {
  const primaryIP = readHeaderIP(headers, config.primaryHeader);
  if (primaryIP) {
    return primaryIP;
  }

  if (config.secondaryHeader) {
    return readHeaderIP(headers, config.secondaryHeader);
  }

  return null;
}

function getPlatformContext(): {
  platform: DeploymentPlatform;
  config: TrustedProxyConfig;
} | null {
  const platform = getDeploymentPlatform();
  if (!platform) {
    return null;
  }

  return {
    platform,
    config:
      platform === PLATFORM_CLOUDFLARE
        ? CLOUDFLARE_TRUSTED_PROXY_CONFIG
        : DEVELOPMENT_TRUSTED_PROXY_CONFIG,
  };
}

function getRequestFallbackIP(platform: DeploymentPlatform | null): string {
  if (platform === PLATFORM_DEVELOPMENT) {
    return LOCALHOST_IP;
  }

  return FALLBACK_IP;
}

function canTrustPlatformHeaders(platformContext: {
  platform: DeploymentPlatform;
  config: TrustedProxyConfig;
}): boolean {
  return (
    platformContext.platform === PLATFORM_CLOUDFLARE ||
    platformContext.platform === PLATFORM_DEVELOPMENT
  );
}

export function getClientIP(request: NextRequest): string {
  const platformContext = getPlatformContext();
  if (!platformContext) {
    return getRequestFallbackIP(null);
  }

  if (!canTrustPlatformHeaders(platformContext)) {
    return getRequestFallbackIP(platformContext.platform);
  }

  const headerIP = readTrustedHeaderIP(request.headers, platformContext.config);
  if (headerIP) {
    return headerIP;
  }

  return getRequestFallbackIP(platformContext.platform);
}
