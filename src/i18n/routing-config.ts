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

  // localePrefix 'never' disables next-intl alternate links (no-op here);
  // canonical/hreflang is handled by the metadata layer.

  localeDetection: false,

  // 配置locale cookie - 持久化用户语言偏好
  localeCookie: {
    name: "NEXT_LOCALE",
    // 自选 1 年持久化；next-intl 4 默认为会话级，加语种上线前复核 cookie 声明合规
    maxAge: 60 * 60 * 24 * 365,
  },
});

// 导出类型，使用统一配置
export type Locale = (typeof routing.locales)[number];
