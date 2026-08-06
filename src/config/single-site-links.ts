import { PUBLIC_STATIC_PAGE_TYPES } from "@/config/pages.config";
import { getCanonicalPath } from "@/config/paths/utils";

export const SINGLE_SITE_ROUTE_HREFS = {
  home: getCanonicalPath("home"),
  about: getCanonicalPath("about"),
  contact: getCanonicalPath("contact"),
  oemWholesale: getCanonicalPath("oemWholesale"),
  materialsGuide: getCanonicalPath("materialsGuide"),
  specificationsGuide: getCanonicalPath("specificationsGuide"),
  requestQuote: getCanonicalPath("requestQuote"),
  warranty: getCanonicalPath("warranty"),
  products: getCanonicalPath("products"),
  privacy: getCanonicalPath("privacy"),
  terms: getCanonicalPath("terms"),
} as const;

export interface SingleSiteHomeLinkTargets {
  primaryCta: string;
  secondaryCta: string;
  contact?: string;
  oemWholesale?: string;
  requestQuote?: string;
  products?: string;
  about?: string;
}

export interface SingleSiteActiveRouteTargets {
  about?: string;
  contact?: string;
  oemWholesale?: string;
  products?: string;
  requestQuote?: string;
}

export interface SingleSiteHomeFinalCtaTarget {
  href: string;
  labelKey: "primary" | "secondary";
}

function activeHref(
  active: ReadonlySet<string>,
  pageType: keyof typeof SINGLE_SITE_ROUTE_HREFS,
): string | undefined {
  return active.has(pageType) ? SINGLE_SITE_ROUTE_HREFS[pageType] : undefined;
}

export function getSingleSiteActiveRouteTargets(): SingleSiteActiveRouteTargets {
  const active = new Set(PUBLIC_STATIC_PAGE_TYPES);
  const about = activeHref(active, "about");
  const contact = activeHref(active, "contact");
  const oemWholesale = activeHref(active, "oemWholesale");
  const products = activeHref(active, "products");
  const requestQuote = activeHref(active, "requestQuote");

  return {
    ...(about !== undefined ? { about } : {}),
    ...(contact !== undefined ? { contact } : {}),
    ...(oemWholesale !== undefined ? { oemWholesale } : {}),
    ...(products !== undefined ? { products } : {}),
    ...(requestQuote !== undefined ? { requestQuote } : {}),
  };
}

export function getSingleSiteHomeLinkTargets(): SingleSiteHomeLinkTargets {
  const activeTargets = getSingleSiteActiveRouteTargets();

  // The catalog site always exposes the products route, so home links always
  // resolve through the product-oriented targets.
  return getProductHomeLinkTargets({
    ...activeTargets,
    products: activeTargets.products ?? SINGLE_SITE_ROUTE_HREFS.products,
  });
}

export const SINGLE_SITE_HOME_LINK_TARGETS = getSingleSiteHomeLinkTargets();

function getProductHomeLinkTargets(
  targets: SingleSiteActiveRouteTargets & { products: string },
): SingleSiteHomeLinkTargets {
  const { contact, oemWholesale, products, requestQuote } = targets;

  return {
    ...(contact !== undefined ? { contact } : {}),
    ...(oemWholesale !== undefined ? { oemWholesale } : {}),
    products,
    ...(requestQuote !== undefined ? { requestQuote } : {}),
    primaryCta: requestQuote ?? products,
    secondaryCta: oemWholesale ?? contact ?? SINGLE_SITE_ROUTE_HREFS.home,
  };
}

export function getSingleSiteHomeFinalCtaTargetsFromLinks(
  targets: SingleSiteHomeLinkTargets,
): SingleSiteHomeFinalCtaTarget[] {
  const primaryHref = targets.requestQuote ?? targets.contact;
  const secondaryHref = targets.oemWholesale ?? targets.products;

  return [
    ...(primaryHref !== undefined
      ? [{ href: primaryHref, labelKey: "primary" as const }]
      : []),
    ...(secondaryHref !== undefined
      ? [{ href: secondaryHref, labelKey: "secondary" as const }]
      : []),
  ];
}

export function getSingleSiteHomeFinalCtaTargets(): SingleSiteHomeFinalCtaTarget[] {
  return getSingleSiteHomeFinalCtaTargetsFromLinks(
    getSingleSiteHomeLinkTargets(),
  );
}
