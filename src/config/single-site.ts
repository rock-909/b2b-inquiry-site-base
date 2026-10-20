import { env, isRuntimeProduction, runtimeEnv } from "@/lib/env";
import {
  PUBLIC_STATIC_PAGE_DEFINITIONS,
  type NavigationMessageKey,
} from "@/config/pages.config";
import { assertValidSiteConfig } from "@/config/site-config-schema";
import type { SiteConfig } from "@/config/site-types";

export type {
  CompanyInfo,
  ContactInfo,
  SiteConfig,
  SiteNavigationItem,
  SiteSeoConfig,
  SocialLinks,
} from "@/config/site-types";

function resolveSingleSiteBaseUrl(fallback: string): string {
  const explicitSiteUrl = runtimeEnv.NEXT_PUBLIC_SITE_URL?.trim();
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

// 去掉结尾斜杠：robots 等处直接拼接路径，`https://acme.com/` 会得到 `//sitemap.xml`。
const baseUrl = resolveSingleSiteBaseUrl("https://example.invalid").replace(
  /\/+$/u,
  "",
);

type StaticPageDefinition = (typeof PUBLIC_STATIC_PAGE_DEFINITIONS)[number];
type FooterNavigationPage = Extract<
  StaticPageDefinition,
  { navigationKey: NavigationMessageKey }
>;
type FooterSupportPage = Extract<
  StaticPageDefinition,
  { pageType: "privacy" | "terms" }
>;
// 页脚文案 key 由栏目和 pageType 推导：新页面只需在 messages 补文案，缺了 t() 类型检查会报错。
type FooterLinkTranslationKey =
  | `footer.sections.navigation.${FooterNavigationPage["pageType"]}`
  | `footer.sections.support.${FooterSupportPage["pageType"]}`;

interface FooterLinkItem {
  key: StaticPageDefinition["pageType"];
  href: StaticPageDefinition["path"];
  translationKey: FooterLinkTranslationKey;
}

function getFooterLinks(
  column: "navigation" | "support",
  pages: readonly (FooterNavigationPage | FooterSupportPage)[],
): FooterLinkItem[] {
  return pages.map(({ pageType, path }) => ({
    key: pageType,
    href: path,
    translationKey:
      `footer.sections.${column}.${pageType}` as FooterLinkTranslationKey,
  }));
}

// 页脚导航列与主导航是同一份页面清单（pages.config 的 navigationKey）。
export const SINGLE_SITE_FOOTER_COLUMNS = [
  {
    key: "navigation",
    links: getFooterLinks(
      "navigation",
      PUBLIC_STATIC_PAGE_DEFINITIONS.filter(
        (page): page is FooterNavigationPage => page.navigationKey !== null,
      ),
    ),
  },
  {
    key: "support",
    links: getFooterLinks(
      "support",
      PUBLIC_STATIC_PAGE_DEFINITIONS.filter(
        (page): page is FooterSupportPage =>
          page.pageType === "privacy" || page.pageType === "terms",
      ),
    ),
  },
] as const;

const siteName = "B2B Inquiry Template";

/**
 * Single-site canonical source for the current cutover phase.
 */
const siteConfig: SiteConfig = {
  baseUrl,
  name: siteName,
  description:
    "Neutral B2B inquiry reference site that must be replaced before launch",
  seo: {
    titleTemplate: `%s | ${siteName}`,
    defaultTitle: siteName,
    defaultDescription:
      "A non-production B2B inquiry reference site using sentinel identity, domain, and contact details.",
  },
  // 留空即不展示；上线门禁要求填入业主确认的邮箱。
  contact: {
    email: "",
  },
  social: {
    twitter: "",
    linkedin: "",
  },
  brandAssets: {
    ogImage: "/opengraph-image.png",
    favicon: "/icon.svg",
  },
};

assertValidSiteConfig(siteConfig);

export const SINGLE_SITE_CONFIG = siteConfig;
