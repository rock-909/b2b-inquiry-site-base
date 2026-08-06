/**
 * Navigation Configuration and Utilities
 *
 * This module provides navigation configuration, route definitions,
 * and utility functions for the responsive navigation system.
 */
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import {
  SINGLE_SITE_NAVIGATION,
  type SiteNavigationItem,
} from "@/config/single-site-navigation";

export type NavigationItem = SiteNavigationItem;

// Main navigation is authored in `src/config/single-site.ts`; this wrapper keeps
// existing consumers pinned to the active single-site source.
export const mainNavigation: NavigationItem[] = SINGLE_SITE_NAVIGATION;

// Mobile navigation configuration (can be different from main nav)
export const mobileNavigation: NavigationItem[] = mainNavigation;

// Utility function to check if a path is active
export function isActivePath(currentPath: string, itemPath: string): boolean {
  // Handle empty string as root path
  let cleanCurrentPath = currentPath || "/";

  // Remove locale prefix for comparison using safe string matching
  for (const locale of LOCALES_CONFIG.locales) {
    const localePrefix = `/${locale}`;
    if (cleanCurrentPath.startsWith(localePrefix)) {
      cleanCurrentPath = cleanCurrentPath.slice(localePrefix.length) || "/";
      break;
    }
  }

  const cleanItemPath = itemPath === "/" ? "/" : itemPath;

  // Handle root path matching
  if (cleanItemPath === "/") {
    return cleanCurrentPath === "/";
  }

  // Ensure we match complete path segments, not partial matches
  // Add trailing slash to both paths for comparison to avoid partial matches
  const normalizedCurrentPath = cleanCurrentPath.endsWith("/")
    ? cleanCurrentPath
    : `${cleanCurrentPath}/`;
  const normalizedItemPath = cleanItemPath.endsWith("/")
    ? cleanItemPath
    : `${cleanItemPath}/`;

  return normalizedCurrentPath.startsWith(normalizedItemPath);
}
