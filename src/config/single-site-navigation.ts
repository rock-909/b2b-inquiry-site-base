import {
  PUBLIC_STATIC_PAGE_DEFINITIONS,
  toNavigationNamespaceKey,
} from "@/config/pages.config";
import { PATHS_CONFIG } from "@/config/paths/paths-config";

export type { SiteNavigationItem } from "@/config/site-types";

// 主导航 = pages.config 里带 navigationKey 的页面，顺序同页面清单。
export const SINGLE_SITE_NAVIGATION = PUBLIC_STATIC_PAGE_DEFINITIONS.flatMap(
  (definition) =>
    definition.navigationKey
      ? [
          {
            key: definition.pageType,
            href: PATHS_CONFIG[definition.pageType],
            messageKey: toNavigationNamespaceKey(definition.navigationKey),
          },
        ]
      : [],
);
