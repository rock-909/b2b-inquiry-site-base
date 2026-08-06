import { env, isRuntimeProduction, runtimeEnv } from "@/lib/env";
import type { PageType } from "@/config/paths/types";
import { PUBLIC_STATIC_PAGE_TYPES } from "@/config/pages.config";
import { SINGLE_SITE_ROUTE_HREFS } from "@/config/single-site-links";
import { SINGLE_SITE_NAVIGATION } from "@/config/single-site-navigation";
import { singleSiteProductCatalog } from "@/config/single-site-product-catalog";
import type {
  SiteConfig,
  SiteDefinition,
  SiteFacts,
} from "@/config/site-types";

export type {
  BusinessHours,
  BusinessStats,
  Certification,
  CompanyInfo,
  ContactInfo,
  MarketDefinition,
  ProductCatalog,
  SiteConfig,
  SiteDefinition,
  SiteFacts,
  SiteFooterColumnConfig,
  SiteFooterLinkItem,
  SiteNavigationItem,
  SiteSeoConfig,
  SiteSocialConfig,
  SocialLinks,
} from "@/config/site-types";

function resolveSingleSiteBaseUrl(fallback: string): string {
  const explicitSiteUrl =
    runtimeEnv.NEXT_PUBLIC_SITE_URL?.trim() ?? env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicitSiteUrl) return explicitSiteUrl;

  const runtimeSharedBaseUrl = runtimeEnv.NEXT_PUBLIC_BASE_URL?.trim();
  if (runtimeSharedBaseUrl) return runtimeSharedBaseUrl;

  const sharedBaseUrl = env.NEXT_PUBLIC_BASE_URL?.trim();
  if (isRuntimeProduction() && sharedBaseUrl === "http://localhost:3000") {
    return fallback;
  }
  if (sharedBaseUrl) return sharedBaseUrl;

  return fallback;
}

const baseUrl = resolveSingleSiteBaseUrl(
  "https://tucsenberg-site-preview.faints-pudgier-9r.workers.dev",
);

const social = {
  twitter: "",
  linkedin: "",
} as const;

const FOOTER_NAVIGATION_PAGE_TYPES = [
  "home",
  "products",
  "oemWholesale",
  "materialsGuide",
  "specificationsGuide",
  "about",
] as const satisfies readonly PageType[];

const FOOTER_SUPPORT_PAGE_TYPES = [
  "requestQuote",
  "contact",
  "warranty",
  "privacy",
  "terms",
] as const satisfies readonly PageType[];

type FooterLinkPageType =
  | (typeof FOOTER_NAVIGATION_PAGE_TYPES)[number]
  | (typeof FOOTER_SUPPORT_PAGE_TYPES)[number];

const FOOTER_TRANSLATION_KEYS = {
  home: "footer.sections.navigation.home",
  products: "footer.sections.navigation.products",
  oemWholesale: "footer.sections.navigation.oemWholesale",
  materialsGuide: "footer.sections.navigation.materialsGuide",
  specificationsGuide: "footer.sections.navigation.specificationsGuide",
  about: "footer.sections.navigation.about",
  requestQuote: "footer.sections.support.requestQuote",
  contact: "footer.sections.support.contact",
  warranty: "footer.sections.support.warranty",
  privacy: "footer.sections.support.privacy",
  terms: "footer.sections.support.terms",
} as const satisfies Record<FooterLinkPageType, string>;

const FOOTER_COLUMN_TRANSLATION_KEYS = {
  navigation: "footer.sections.navigation.title",
  support: "footer.sections.support.title",
} as const;

function getFooterLinkItem(pageType: FooterLinkPageType) {
  const href = SINGLE_SITE_ROUTE_HREFS[pageType];
  const translationKey = FOOTER_TRANSLATION_KEYS[pageType];

  if (href === undefined || translationKey === undefined) {
    throw new Error(
      `Missing footer link configuration for page type: ${pageType}`,
    );
  }

  return {
    key: pageType,
    href,
    external: false,
    translationKey,
  } as const;
}

function filterActiveFooterPages<T extends FooterLinkPageType>(
  orderedPageTypes: readonly T[],
  activePageTypes: readonly PageType[],
): T[] {
  const active = new Set(activePageTypes);

  return orderedPageTypes.filter((pageType) => active.has(pageType));
}

export function getSingleSiteFooterColumns() {
  const activePageTypes = PUBLIC_STATIC_PAGE_TYPES;
  const navigationLinks = filterActiveFooterPages(
    FOOTER_NAVIGATION_PAGE_TYPES,
    activePageTypes,
  ).map(getFooterLinkItem);
  const supportLinks = filterActiveFooterPages(
    FOOTER_SUPPORT_PAGE_TYPES,
    activePageTypes,
  ).map(getFooterLinkItem);

  return [
    {
      key: "navigation",
      translationKey: FOOTER_COLUMN_TRANSLATION_KEYS.navigation,
      links: navigationLinks,
    },
    {
      key: "support",
      translationKey: FOOTER_COLUMN_TRANSLATION_KEYS.support,
      links: supportLinks,
    },
  ] as const;
}

export const TUCSENBERG_REGISTERED_ADDRESS =
  "No. 47, Houhe Village, Dongwangji Town, Guanyun County, Lianyungang City, Jiangsu, China";

const contact = {
  phone: "",
  email: "sales@tucsenberg.com",
} as const;

const establishedYear = 2021;
const siteFactSnapshotYear = 2026;

/**
 * Single-site canonical source for the current cutover phase.
 */
export const SINGLE_SITE_KEY = "tucsenberg" as const;
export const SINGLE_SITE_DEFINITION = {
  key: SINGLE_SITE_KEY,
  config: {
    baseUrl,
    name: "Tucsenberg",
    description: "Factory-direct flood barrier supply from China",
    seo: {
      titleTemplate: "%s | Tucsenberg",
      defaultTitle:
        "Flood Barrier Manufacturer & Supplier from China | Tucsenberg",
      defaultDescription:
        "Factory-direct flood barriers from China: ABS boxwall, aluminum flood gates, sandless flood bags and tube dams. OEM & private label. Reply within 12 hours.",
    },
    social,
    contact,
  },
  facts: {
    company: {
      name: "Jiangsu Tucson Borg Technology Co., Ltd. (trading as Tucsenberg)",
      established: establishedYear,
      yearsInBusiness: siteFactSnapshotYear - establishedYear,
      employees: 0,
      location: {
        country: "China",
        city: "Lianyungang, Jiangsu",
        address: TUCSENBERG_REGISTERED_ADDRESS,
      },
    },
    contact: {
      phone: contact.phone,
      email: contact.email,
      businessHours: {
        weekdays: "UTC+8",
        saturday: "By appointment",
        sundayClosed: true,
      },
    },
    certifications: [],
    stats: {
      exportCountries: 0,
      annualCapacity:
        "ABS boxwall, aluminum gates, flood bags, tube dams, and FRP planks",
      clientsServed: 0,
      onTimeDeliveryRate: 0,
    },
    social,
    brandAssets: {
      logo: {
        status: "ready",
        horizontal: "/images/tucsenberg-logo.png",
        horizontalPng: "/images/tucsenberg-logo.png",
        square: "/images/tucsenberg-logo-square.png",
        width: 240,
        height: 72,
      },
      productPhotos: {
        status: "pending",
      },
      ogImage: "/images/tucsenberg-og.png",
      favicon: "/favicon.ico",
    },
  },
  productCatalog: singleSiteProductCatalog,
  navigation: {
    main: SINGLE_SITE_NAVIGATION,
  },
  footerColumns: getSingleSiteFooterColumns(),
} as const satisfies SiteDefinition;

export const SINGLE_SITE_CONFIG: SiteConfig = SINGLE_SITE_DEFINITION.config;
export const SINGLE_SITE_FACTS: SiteFacts = SINGLE_SITE_DEFINITION.facts;
export const SINGLE_SITE_FOOTER_COLUMNS = getSingleSiteFooterColumns();
