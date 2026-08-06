import type { MetadataRoute } from "next";
import {
  getMdxPageLastModified,
  isMdxDrivenPage,
} from "@/lib/content/page-dates";
import {
  getStaticPageLastModified,
  type StaticPageLastModConfig,
} from "@/lib/sitemap-utils";
import {
  LOCALES_CONFIG,
  getProductMarketPath,
  SITE_CONFIG,
} from "@/config/paths";
import {
  getSingleSitePublicStaticPages,
  getSingleSiteSitemapPageConfig,
  getSingleSiteStaticPageLastmod,
  hasSingleSiteDynamicSurface,
  type SingleSiteSitemapPageConfig,
} from "@/config/single-site-seo";
import { routing } from "@/i18n/routing";
import { PRODUCT_CATALOG } from "@/constants/product-catalog";

// Base URL for the site - uses centralized SITE_CONFIG for consistency
const BASE_URL = SITE_CONFIG.baseUrl;

type PageConfig = SingleSiteSitemapPageConfig;

function createStaticPageLastmod(): StaticPageLastModConfig {
  return new Map(
    Object.entries(getSingleSiteStaticPageLastmod()).map(([route, isoDate]) => [
      route,
      new Date(isoDate),
    ]),
  );
}

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
  lastModified: Date;
  config: PageConfig;
  alternates: Record<string, string>;
}

// Generate a single sitemap entry
function createSitemapEntry(
  params: SitemapEntryParams,
): MetadataRoute.Sitemap[number] {
  return {
    url: params.url,
    lastModified: params.lastModified,
    changeFrequency: params.config.changeFrequency,
    priority: params.config.priority,
    alternates: {
      languages: params.alternates,
    },
  };
}

// Generate static page entries for all locales
async function generateStaticPageEntries(): Promise<MetadataRoute.Sitemap> {
  const publicStaticPages = getSingleSitePublicStaticPages();
  const staticPageLastmod = createStaticPageLastmod();
  const mdxPages = publicStaticPages.filter(isMdxDrivenPage);
  const mdxDates = new Map<string, Date>();
  await Promise.all(
    mdxPages.map(async (page) => {
      mdxDates.set(page, await getMdxPageLastModified(page));
    }),
  );

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const page of publicStaticPages) {
      const config = getPageConfig(page);
      const url = buildAbsoluteUrl(locale, page);
      const alternates = buildAlternateLanguages(page);
      const lastModified =
        mdxDates.get(page) ??
        getStaticPageLastModified(page, staticPageLastmod);

      entries.push(
        createSitemapEntry({ url, lastModified, config, alternates }),
      );
    }
  }

  return entries;
}

// Generate product catalog entries (market + family pages) for all locales
function generateCatalogEntries(): MetadataRoute.Sitemap {
  if (!hasSingleSiteDynamicSurface("productMarket")) {
    return [];
  }

  const entries: MetadataRoute.Sitemap = [];
  const staticPageLastmod = createStaticPageLastmod();

  const marketConfig = getPageConfig("productMarket");
  for (const market of PRODUCT_CATALOG.markets) {
    const path = getProductMarketPath(market.slug);
    const lastModified = getStaticPageLastModified(path, staticPageLastmod);

    for (const locale of routing.locales) {
      entries.push(
        createSitemapEntry({
          url: buildAbsoluteUrl(locale, path),
          lastModified,
          config: marketConfig,
          alternates: buildAlternateLanguages(path),
        }),
      );
    }
  }

  return entries;
}

export async function generateSitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = await generateStaticPageEntries();
  const catalogEntries = generateCatalogEntries();

  return [...staticEntries, ...catalogEntries];
}

/**
 * Dynamic sitemap generation for Next.js.
 * Includes the catalog site's static pages and its product-market surface.
 */
export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return generateSitemap();
}
