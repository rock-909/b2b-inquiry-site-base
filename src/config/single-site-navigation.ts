import {
  PUBLIC_STATIC_PAGE_DEFINITIONS,
  getPublicStaticPageDefinition,
  toNavigationNamespaceKey,
  type NavigationMessageKey,
} from "@/config/pages.config";
import { SINGLE_SITE_ROUTE_HREFS } from "@/config/single-site-links";

export type { SiteNavigationItem } from "@/config/site-types";

type SingleSiteRoutePageType = keyof typeof SINGLE_SITE_ROUTE_HREFS;

const MAIN_NAVIGATION_PAGE_TYPES = [
  "home",
  "products",
  "oemWholesale",
  "materialsGuide",
  "about",
] as const satisfies readonly SingleSiteRoutePageType[];

function requireNavigationKey(
  pageType: SingleSiteRoutePageType,
): NavigationMessageKey {
  const definition = getPublicStaticPageDefinition(pageType);

  if (definition === undefined) {
    throw new Error(`Missing static public page definition for: ${pageType}`);
  }

  const { navigationKey } = definition;

  if (navigationKey === null) {
    throw new Error(`Missing navigationKey for page type: ${pageType}`);
  }

  return navigationKey;
}

function requireRouteHref(pageType: SingleSiteRoutePageType): string {
  const href = SINGLE_SITE_ROUTE_HREFS[pageType];

  if (href === undefined) {
    throw new Error(`Missing route href for page type: ${pageType}`);
  }

  return href;
}

export function getSingleSiteNavigation() {
  const activePageTypes = new Set(
    PUBLIC_STATIC_PAGE_DEFINITIONS.map((definition) => definition.pageType),
  );

  return MAIN_NAVIGATION_PAGE_TYPES.flatMap((pageType) =>
    activePageTypes.has(pageType)
      ? [
          {
            key: pageType,
            href: requireRouteHref(pageType),
            messageKey: toNavigationNamespaceKey(
              requireNavigationKey(pageType),
            ),
          },
        ]
      : [],
  );
}

export const SINGLE_SITE_NAVIGATION = getSingleSiteNavigation();
