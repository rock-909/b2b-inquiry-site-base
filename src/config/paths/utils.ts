/**
 * 路径配置工具函数
 */

import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import { PATHS_CONFIG } from "@/config/paths/paths-config";
import type { Locale, PageType } from "@/config/paths/types";

type StaticPathname = (typeof PATHS_CONFIG)[PageType];
type DerivedPathname = StaticPathname;
type PathnameMap = Readonly<Record<DerivedPathname, DerivedPathname>>;

function getCanonicalPathValue(path: string): string {
  return path === "" ? "/" : path;
}

function createPathnames(): Readonly<PathnameMap> {
  const staticPathnames = Object.values(PATHS_CONFIG).map((configuredPath) => {
    const path = getCanonicalPathValue(configuredPath);
    return [path, path] as const;
  });

  return Object.freeze(Object.fromEntries(staticPathnames)) as PathnameMap;
}

/**
 * 获取本地化路径
 */
export function getLocalizedPath(pageType: PageType, locale: Locale): string {
  // 严格验证输入参数
  if (pageType === null || pageType === undefined) {
    throw new Error("Page type cannot be null or undefined");
  }
  if (locale === null || locale === undefined) {
    throw new Error("Locale cannot be null or undefined");
  }

  if (!Object.prototype.hasOwnProperty.call(PATHS_CONFIG, pageType)) {
    throw new Error(`Unknown page type: ${pageType}`);
  }
  if (locale !== LOCALES_CONFIG.defaultLocale) {
    throw new Error(`Unknown locale: ${locale}`);
  }
  return PATHS_CONFIG[pageType];
}

export function getCanonicalPath<T extends PageType>(
  pageType: T,
): (typeof PATHS_CONFIG)[T] {
  return PATHS_CONFIG[pageType];
}

/**
 * 获取所有页面的路径映射（用于next-intl routing）
 *
 * 使用标准路径方案，所有语言使用相同路径
 * 包含静态路径和动态路由模式
 */
export const PATHNAMES = createPathnames();

/**
 * 获取页面类型（根据路径反向查找）
 */
export function getPageTypeFromPath(
  path: string,
  locale: Locale,
): PageType | null {
  // 严格验证输入参数
  if (path === null || path === undefined) {
    throw new Error("Path cannot be null or undefined");
  }
  if (locale === null || locale === undefined) {
    throw new Error("Locale cannot be null or undefined");
  }

  // 处理根路径
  if (path === "/" || path === "") {
    return "home";
  }

  // 查找匹配的页面类型
  if (locale !== LOCALES_CONFIG.defaultLocale) {
    throw new Error(`Unknown locale: ${locale}`);
  }

  for (const [pageType, configuredPath] of Object.entries(PATHS_CONFIG)) {
    if (configuredPath === path) {
      return pageType as PageType;
    }
  }

  return null;
}
