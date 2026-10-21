import {
  PUBLIC_STATIC_PAGE_DEFINITIONS,
  toNavigationNamespaceKey,
} from "@/config/pages.config";
import { PATHS_CONFIG } from "@/config/paths/paths-config";
import type { SiteNavigationItem } from "@/config/site-types";

export type { SiteNavigationItem } from "@/config/site-types";

// 主导航 = pages.config 里带 navigationKey 的页面，顺序同页面清单。
// 联系页由头部 CTA 承担，不在主导航里重复；页脚仍按 navigationKey 列出它。
// 二级菜单：写成 [...上面的页面项, { key, messageKey, groups: [{ key, messageKey, links }] }]，
// 文案 key 加进 messages 的 navigation；桌面渲染为整宽分栏面板，手机抽屉里折叠展开。
export const SINGLE_SITE_NAVIGATION: readonly SiteNavigationItem[] =
  PUBLIC_STATIC_PAGE_DEFINITIONS.flatMap((definition) =>
    definition.navigationKey && definition.pageType !== "contact"
      ? [
          {
            key: definition.pageType,
            href: PATHS_CONFIG[definition.pageType],
            messageKey: toNavigationNamespaceKey(definition.navigationKey),
          },
        ]
      : [],
  );
