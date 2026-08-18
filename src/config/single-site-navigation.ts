import {
  getPublicStaticPageDefinition,
  toNavigationNamespaceKey,
  type NavigationMessageKey,
} from "@/config/pages.config";
import { PATHS_CONFIG } from "@/config/paths/paths-config";

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

export const SINGLE_SITE_NAVIGATION = MAIN_NAVIGATION_PAGE_TYPES.map(
  (pageType) => ({
    key: pageType,
    href: PATHS_CONFIG[pageType],
    messageKey: toNavigationNamespaceKey(requireNavigationKey(pageType)),
  }),
);
