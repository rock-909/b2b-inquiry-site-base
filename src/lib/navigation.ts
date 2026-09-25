/**
 * Navigation Configuration and Utilities
 *
 * This module provides navigation configuration, route definitions,
 * and utility functions for the responsive navigation system.
 */
import { LOCALES_CONFIG } from "@/config/paths/locales-config";

// Utility function to check if a path is active
export function isActivePath(currentPath: string, itemPath: string): boolean {
  // Handle empty string as root path
  let cleanCurrentPath = currentPath || "/";

  // 只去掉完整的 locale 段："/en/about" 变成 "/about"，"/enquiry" 保持不变。
  for (const locale of LOCALES_CONFIG.locales) {
    const localePrefix = `/${locale}`;
    if (
      cleanCurrentPath === localePrefix ||
      cleanCurrentPath.startsWith(`${localePrefix}/`)
    ) {
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
