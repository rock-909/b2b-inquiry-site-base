import type { MetadataRoute } from "next";
import {
  getStaticContentPageLastModified,
  isStaticContentPage,
} from "@/lib/content/page-dates";
import type { Locale } from "@/config/paths";
import { OFFERINGS, getOfferingPath } from "@/config/offerings";
import {
  getSingleSitePublicStaticPages,
  getSingleSiteSitemapPageConfig,
  type SingleSiteSitemapPageConfig,
} from "@/config/single-site-seo";
import { routing } from "@/i18n/routing";
import {
  buildCanonicalForPath,
  buildLanguagesForPath,
} from "@/lib/seo-metadata";

type PageConfig = SingleSiteSitemapPageConfig;

// Helper to get page config
function getPageConfig(path: string): PageConfig {
  return getSingleSiteSitemapPageConfig(path);
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
  locale: Locale,
  config: PageConfig,
): MetadataRoute.Sitemap {
  return OFFERINGS.map((offering) => {
    const productPath = getOfferingPath(offering.id);
    return createSitemapEntry({
      url: buildCanonicalForPath(productPath, locale),
      lastModified: new Date(offering.updatedAt),
      config,
      alternates: buildLanguagesForPath(productPath),
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
      const url = buildCanonicalForPath(page, locale);
      const alternates = buildLanguagesForPath(page);
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
