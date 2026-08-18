import type { MetadataRoute } from "next";
import {
  getStaticContentPageLastModified,
  isStaticContentPage,
} from "@/lib/content/page-dates";
import { LOCALES_CONFIG } from "@/config/paths";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";
import { OFFERINGS, getOfferingPath } from "@/config/offerings";
import {
  getSingleSitePublicStaticPages,
  getSingleSiteSitemapPageConfig,
  type SingleSiteSitemapPageConfig,
} from "@/config/single-site-seo";
import { routing } from "@/i18n/routing";

// Base URL for the site - uses centralized SITE_CONFIG for consistency
const BASE_URL = SINGLE_SITE_CONFIG.baseUrl;

type PageConfig = SingleSiteSitemapPageConfig;

// Helper to get page config
function getPageConfig(path: string): PageConfig {
  return getSingleSiteSitemapPageConfig(path);
}

function buildLocalePath(locale: string, path: string): string {
  const normalizedPath = path === "" ? "/" : path;

  if (LOCALES_CONFIG.localePrefix === "never") {
    return normalizedPath;
  }

  return normalizedPath === "/" ? `/${locale}` : `/${locale}${normalizedPath}`;
}

function buildAbsoluteUrl(locale: string, path: string): string {
  return new URL(buildLocalePath(locale, path), BASE_URL).toString();
}

// Build alternate languages object for a URL path
function buildAlternateLanguages(path: string): Record<string, string> {
  const entries = routing.locales.map((locale) => [
    locale,
    buildAbsoluteUrl(locale, path),
  ]);
  // x-default 指向默认语言版本，帮助搜索引擎识别语言选择器页面
  entries.push(["x-default", buildAbsoluteUrl(routing.defaultLocale, path)]);
  return Object.fromEntries(entries);
}

interface SitemapEntryParams {
  url: string;
  lastModified?: Date | undefined;
  config: PageConfig;
  alternates: Record<string, string>;
}

// Generate a single sitemap entry
function createSitemapEntry(
  params: SitemapEntryParams,
): MetadataRoute.Sitemap[number] {
  return {
    url: params.url,
    ...(params.lastModified ? { lastModified: params.lastModified } : {}),
    changeFrequency: params.config.changeFrequency,
    priority: params.config.priority,
    alternates: {
      languages: params.alternates,
    },
  };
}

function createProductEntries(
  locale: string,
  config: PageConfig,
): MetadataRoute.Sitemap {
  return OFFERINGS.map((offering) => {
    const productPath = getOfferingPath(offering.id);
    return createSitemapEntry({
      url: buildAbsoluteUrl(locale, productPath),
      lastModified: new Date(offering.updatedAt),
      config,
      alternates: buildAlternateLanguages(productPath),
    });
  });
}

// Generate static page entries for all locales
async function generateStaticPageEntries(): Promise<MetadataRoute.Sitemap> {
  const publicStaticPages = getSingleSitePublicStaticPages();
  const contentPages = publicStaticPages.filter(isStaticContentPage);
  const contentDates = new Map<string, Date>();
  await Promise.all(
    contentPages.map(async (page) => {
      contentDates.set(page, await getStaticContentPageLastModified(page));
    }),
  );

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const page of publicStaticPages) {
      const config = getPageConfig(page);
      const url = buildAbsoluteUrl(locale, page);
      const alternates = buildAlternateLanguages(page);
      const lastModified = contentDates.get(page);

      entries.push(
        createSitemapEntry({ url, lastModified, config, alternates }),
      );

      if (page === "/products") {
        entries.push(...createProductEntries(locale, config));
      }
    }
  }

  return entries;
}

export function generateSitemap(): Promise<MetadataRoute.Sitemap> {
  return generateStaticPageEntries();
}

/**
 * Dynamic sitemap generation for Next.js.
 * Includes the template's public pages and configured products.
 */
export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return generateSitemap();
}
