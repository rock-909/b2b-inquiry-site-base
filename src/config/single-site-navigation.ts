import {
  PUBLIC_STATIC_PAGE_DEFINITIONS,
  getPublicStaticPageDefinition,
  toNavigationNamespaceKey,
  type NavigationMessageKey,
} from "@/config/pages.config";
import { SINGLE_SITE_ROUTE_HREFS } from "@/config/single-site-links";

export type { SiteNavigationItem } from "@/config/site-types";

const MAIN_NAVIGATION_PAGE_TYPES = [
  "home",
  "products",
  "about",
  "contact",
] as const;

function requireNavigationKey(
  pageType: (typeof MAIN_NAVIGATION_PAGE_TYPES)[number],
): NavigationMessageKey {
  const definition = getPublicStaticPageDefinition(pageType);
  if (!definition?.navigationKey) {
    throw new Error(`Missing navigation key for page type: ${pageType}`);
  }
  return definition.navigationKey;
}

export function getSingleSiteNavigation() {
  const active = new Set(
    PUBLIC_STATIC_PAGE_DEFINITIONS.map((item) => item.pageType),
  );
  return MAIN_NAVIGATION_PAGE_TYPES.flatMap((pageType) =>
    active.has(pageType)
      ? [
          {
            key: pageType,
            href: SINGLE_SITE_ROUTE_HREFS[pageType],
            messageKey: toNavigationNamespaceKey(
              requireNavigationKey(pageType),
            ),
          },
        ]
      : [],
  );
}

export const SINGLE_SITE_NAVIGATION = getSingleSiteNavigation();
