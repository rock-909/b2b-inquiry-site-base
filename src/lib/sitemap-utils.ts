/**
 * Sitemap utility functions
 *
 * Provides helpers for sitemap generation, including lastmod calculation
 * for static pages.
 */

import { logger } from "@/lib/logger";

const SITEMAP_FALLBACK_LASTMOD = new Date("2026-01-01T00:00:00Z");

/**
 * Static page configuration for lastmod.
 *
 * Maps static page paths to their last modification dates.
 * This can be used for pages that don't have MDX content.
 */
export type StaticPageLastModConfig = Map<string, Date>;

/**
 * Get last modified date for a static page.
 *
 * @param path - The page path (e.g., '/about', '/contact')
 * @param config - Optional static page lastmod configuration
 * @returns Date object, or fixed fallback date if not configured
 */
export function getStaticPageLastModified(
  path: string,
  config?: StaticPageLastModConfig,
): Date {
  if (config !== undefined) {
    const date = config.get(path);
    if (date !== undefined) {
      return date;
    }
  }
  logger.warn("Sitemap static page lastmod fallback used", {
    fallbackLastmod: SITEMAP_FALLBACK_LASTMOD.toISOString(),
    path,
  });
  return SITEMAP_FALLBACK_LASTMOD;
}
