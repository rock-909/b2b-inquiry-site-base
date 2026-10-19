import { defineRouting } from "next-intl/routing";
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import { PATHNAMES } from "@/config/paths/utils";

/**
 * Core routing configuration for next-intl.
 * This file contains only the routing definition without navigation exports,
 * making it safe to import in runtime boundary entrypoints such as `src/middleware.ts`.
 *
 * For navigation components (Link, redirect, usePathname, useRouter),
 * import from '@/i18n/routing' instead.
 */
export const routing = defineRouting({
  locales: LOCALES_CONFIG.locales,
  defaultLocale: LOCALES_CONFIG.defaultLocale,
  localePrefix: LOCALES_CONFIG.localePrefix,

  // Shared Pathnames - 所有语言使用相同路径，简单可靠
  // 注意：仅包含已实现的页面路径，避免 404 错误
  pathnames: PATHNAMES,

  // hreflang/canonical 只由 metadata 层输出；next-intl 的 Link 响应头会按请求 Host 生成 URL。
  alternateLinks: false,

  localeDetection: false,

  // localeDetection 关闭时 next-intl 不读这个 cookie，写入它只会在同意前留下持久 cookie。
  localeCookie: false,
});

// 导出类型，使用统一配置
export type Locale = (typeof routing.locales)[number];
