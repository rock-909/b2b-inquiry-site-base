/**
 * 统一路径配置管理系统 - 主入口
 * 重新导出所有路径配置相关模块
 */

// 重新导出类型定义
export type {
  DynamicPageType,
  DynamicRoutePattern,
  Locale,
  LocalizedPath,
  PageType,
} from "@/config/paths/types";

// 重新导出配置
export {
  DYNAMIC_PATHS_CONFIG,
  PATHS_CONFIG,
} from "@/config/paths/paths-config";
export {
  getLocaleCurrency,
  getLocaleTimeZone,
  LOCALES_CONFIG,
} from "@/config/paths/locales-config";
export { SITE_CONFIG } from "@/config/paths/site-config";

// 重新导出工具函数
export {
  getCanonicalPath,
  getLocalizedPath,
  getPageTypeFromPath,
  getPathnames,
  getProductMarketPath,
} from "@/config/paths/utils";

// 重新导出类型
export type {
  DynamicPathsConfig,
  PathsConfig,
} from "@/config/paths/paths-config";
export type {
  ConfiguredCurrency,
  ConfiguredLocale,
  LocalesConfig,
} from "@/config/paths/locales-config";
export type { SiteConfig } from "@/config/paths/site-config";
