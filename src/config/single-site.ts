import { env, isRuntimeProduction, runtimeEnv } from "@/lib/env";
import { PATHS_CONFIG } from "@/config/paths/paths-config";
import type { PageType } from "@/config/paths/types";
import { SINGLE_SITE_NAVIGATION } from "@/config/single-site-navigation";
import type { SiteConfig, SiteFacts } from "@/config/site-types";

export type {
  BusinessHours,
  CompanyInfo,
  ContactInfo,
  SiteConfig,
  SiteFacts,
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

const baseUrl = resolveSingleSiteBaseUrl("https://example.invalid");

const social = {
  twitter: "",
  linkedin: "",
} as const;

// 页脚导航列与主导航是同一份页面清单（pages.config 的 navigationKey）。
const FOOTER_NAVIGATION_PAGE_TYPES = SINGLE_SITE_NAVIGATION.map(
  (item) => item.key,
);

const FOOTER_SUPPORT_PAGE_TYPES = [
  "privacy",
  "terms",
] as const satisfies readonly PageType[];

type FooterLinkPageType =
  | (typeof FOOTER_NAVIGATION_PAGE_TYPES)[number]
  | (typeof FOOTER_SUPPORT_PAGE_TYPES)[number];

const FOOTER_TRANSLATION_KEYS = {
  home: "footer.sections.navigation.home",
  products: "footer.sections.navigation.products",
  about: "footer.sections.navigation.about",
  contact: "footer.sections.navigation.contact",
  privacy: "footer.sections.support.privacy",
  terms: "footer.sections.support.terms",
} as const satisfies Record<FooterLinkPageType, string>;

const FOOTER_COLUMN_TRANSLATION_KEYS = {
  navigation: "footer.sections.navigation.title",
  support: "footer.sections.support.title",
} as const;

function getFooterLinkItem(pageType: FooterLinkPageType) {
  return {
    key: pageType,
    href: PATHS_CONFIG[pageType],
    translationKey: FOOTER_TRANSLATION_KEYS[pageType],
  } as const;
}

export const SINGLE_SITE_FOOTER_COLUMNS = [
  {
    key: "navigation",
    translationKey: FOOTER_COLUMN_TRANSLATION_KEYS.navigation,
    links: FOOTER_NAVIGATION_PAGE_TYPES.map(getFooterLinkItem),
  },
  {
    key: "support",
    translationKey: FOOTER_COLUMN_TRANSLATION_KEYS.support,
    links: FOOTER_SUPPORT_PAGE_TYPES.map(getFooterLinkItem),
  },
] as const;

export const TEMPLATE_REGISTERED_ADDRESS = "Replace before launch";

const contact = {
  phone: "",
  email: "sales@example.invalid",
} as const;

const establishedYear = 2026;

/**
 * Single-site canonical source for the current cutover phase.
 */
export const SINGLE_SITE_CONFIG: SiteConfig = {
  baseUrl,
  name: "Northstar Industrial Reference",
  description:
    "Neutral B2B inquiry reference site that must be replaced before launch",
  seo: {
    titleTemplate: "%s | Northstar Industrial Reference",
    defaultTitle: "Northstar Industrial Reference - B2B Inquiry Template",
    defaultDescription:
      "A non-production B2B inquiry reference site using sentinel identity, domain, and contact details.",
  },
  social,
  contact,
};

export const SINGLE_SITE_FACTS: SiteFacts = {
  company: {
    name: "Northstar Industrial Reference",
    established: establishedYear,
    location: {
      country: "Replace before launch",
      city: "Replace before launch",
      address: TEMPLATE_REGISTERED_ADDRESS,
    },
  },
  contact: {
    phone: contact.phone,
    email: contact.email,
    businessHours: {
      weekdays: "Replace before launch",
      saturday: "Replace before launch",
      sundayClosed: false,
    },
  },
  social,
  brandAssets: {
    logo: {
      status: "pending",
      horizontal: "/icon.svg",
      width: 240,
      height: 72,
    },
    ogImage: "/opengraph-image.png",
    favicon: "/icon.svg",
  },
};
