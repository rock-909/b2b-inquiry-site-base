/**
 * 路径配置相关类型定义
 */

import type { ConfiguredLocale as Locale } from "@/config/paths/locales-config";

export type { Locale };

// 路径映射接口定义
export type LocalizedPath = {
  [locale in Locale]: string;
};

// 页面类型定义 (静态路由) - 与 PUBLIC_STATIC_PAGE_DEFINITIONS 中的真实页面一一对应
export type PageType =
  | "home"
  | "about"
  | "products"
  | "oemWholesale"
  | "materialsGuide"
  | "specificationsGuide"
  | "requestQuote"
  | "contact"
  | "warranty"
  | "privacy"
  | "terms";

// 动态路由类型定义
export type DynamicPageType = "productMarket";

// 动态路由路径模式
export interface DynamicRoutePattern {
  pattern: string;
  paramName: string;
  paramNames?: readonly string[];
}
