/**
 * Runtime/validation facade for the single-site configuration.
 *
 * Authoring truth stays in src/config/single-site.ts; this module keeps the
 * runtime export plus production-readiness checks in one stable import path.
 */

import { createRequire } from "node:module";
import { SINGLE_SITE_CONFIG, type SiteConfig } from "@/config/single-site";
import {
  getRuntimeEnvBoolean,
  getRuntimeNodeEnv,
  isRuntimePlaywright,
} from "@/lib/env";

export type { SiteConfig } from "@/config/single-site";

export const SITE_CONFIG = SINGLE_SITE_CONFIG;

/**
 * Shared pure URL readiness (also used by production-config.js).
 * Kept as scripts/quality/public-url-readiness.js so Node checks and the
 * Next runtime share one implementation without a second copy.
 */
const require = createRequire(import.meta.url);
const {
  isPublicBaseUrlReady,
}: {
  isPublicBaseUrlReady: (baseUrl: string) => boolean;
} = require("../../../scripts/quality/public-url-readiness.js");

/**
 * Production placeholder pattern - matches [PLACEHOLDER_NAME] format
 * Used to detect unconfigured values that should be replaced before production
 */
const PLACEHOLDER_PATTERN = /^\[.+\]$/;

/**
 * Check if a value is a placeholder that needs to be configured
 */
export function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERN.test(value);
}

/**
 * Check if the base URL is properly configured for production.
 * Rejects .example hosts, localhost, 127.0.0.1, and workers.dev preview hosts.
 */
export function isBaseUrlConfigured(
  baseUrl: string = SITE_CONFIG.baseUrl,
): boolean {
  if (getRuntimeNodeEnv() !== "production") return true;
  if (isRuntimePlaywright()) return true;
  if (getRuntimeEnvBoolean("SKIP_ENV_VALIDATION")) return true;
  return isPublicBaseUrlReady(baseUrl);
}

/**
 * Get all unconfigured placeholders in SITE_CONFIG
 * Returns array of { path, value } for each placeholder found
 */
export function getUnconfiguredPlaceholders(
  config: SiteConfig = SITE_CONFIG,
): Array<{
  path: string;
  value: string;
}> {
  const placeholders: Array<{ path: string; value: string }> = [];

  if (isPlaceholder(config.name)) {
    placeholders.push({ path: "SITE_CONFIG.name", value: config.name });
  }

  if (isPlaceholder(config.seo.defaultTitle)) {
    placeholders.push({
      path: "SITE_CONFIG.seo.defaultTitle",
      value: config.seo.defaultTitle,
    });
  }
  if (config.seo.titleTemplate.includes("[PROJECT_NAME]")) {
    placeholders.push({
      path: "SITE_CONFIG.seo.titleTemplate",
      value: config.seo.titleTemplate,
    });
  }

  if (isPlaceholder(config.social.twitter)) {
    placeholders.push({
      path: "SITE_CONFIG.social.twitter",
      value: config.social.twitter,
    });
  }
  if (isPlaceholder(config.social.linkedin)) {
    placeholders.push({
      path: "SITE_CONFIG.social.linkedin",
      value: config.social.linkedin,
    });
  }

  if (isPlaceholder(config.contact.email)) {
    placeholders.push({
      path: "SITE_CONFIG.contact.email",
      value: config.contact.email,
    });
  }
  return placeholders;
}

/**
 * Validate site config for production readiness
 * Returns validation result object for build-time checks
 */
export function validateSiteConfig(config: SiteConfig = SITE_CONFIG): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = getRuntimeNodeEnv() === "production";

  if (!isBaseUrlConfigured(config.baseUrl)) {
    const msg = `SITE_CONFIG.baseUrl is not configured for production: ${config.baseUrl}`;
    if (isProduction) {
      errors.push(msg);
    } else {
      warnings.push(msg);
    }
  }

  const placeholders = getUnconfiguredPlaceholders(config);
  for (const { path, value } of placeholders) {
    const msg = `${path} contains placeholder value: ${value}`;
    if (isProduction) {
      errors.push(msg);
    } else {
      warnings.push(msg);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
