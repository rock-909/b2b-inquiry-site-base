import { PUBLIC_STATIC_PAGE_TYPES } from "@/config/pages.config";
import { getCanonicalPath } from "@/config/paths/utils";

export const SINGLE_SITE_ROUTE_HREFS = {
  home: getCanonicalPath("home"),
  about: getCanonicalPath("about"),
  contact: getCanonicalPath("contact"),
  requestQuote: getCanonicalPath("requestQuote"),
  privacy: getCanonicalPath("privacy"),
  terms: getCanonicalPath("terms"),
} as const;

export interface SingleSiteHomeLinkTargets {
  primaryCta: string;
  secondaryCta: string;
  contact?: string;
  requestQuote?: string;
  about?: string;
}

function activeHref(
  active: ReadonlySet<string>,
  pageType: keyof typeof SINGLE_SITE_ROUTE_HREFS,
): string | undefined {
  return active.has(pageType) ? SINGLE_SITE_ROUTE_HREFS[pageType] : undefined;
}

export function getSingleSiteHomeLinkTargets(): SingleSiteHomeLinkTargets {
  const active = new Set(PUBLIC_STATIC_PAGE_TYPES);
  const contact = activeHref(active, "contact");
  const requestQuote = activeHref(active, "requestQuote");
  const about = activeHref(active, "about");

  return {
    primaryCta: requestQuote ?? contact ?? SINGLE_SITE_ROUTE_HREFS.home,
    secondaryCta: about ?? contact ?? SINGLE_SITE_ROUTE_HREFS.home,
    ...(contact !== undefined ? { contact } : {}),
    ...(requestQuote !== undefined ? { requestQuote } : {}),
    ...(about !== undefined ? { about } : {}),
  };
}

export const SINGLE_SITE_HOME_LINK_TARGETS = getSingleSiteHomeLinkTargets();
