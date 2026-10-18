import type { MetadataRoute } from "next";
import {
  getStaticContentPageLastModified,
  isStaticContentPage,
} from "@/lib/content/page-dates";
import { getStaticSitemapPages } from "@/config/pages.config";
import {
  getSingleSiteSitemapPageConfig,
  type SingleSiteSitemapPageConfig,
} from "@/config/single-site-seo";
import { routing } from "@/i18n/routing";
import {
  buildCanonicalForPath,
  buildLanguagesForPath,
} from "@/lib/seo-metadata";

type PageConfig = SingleSiteSitemapPageConfig;

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

// Generate static page entries for all locales
async function generateStaticPageEntries(): Promise<MetadataRoute.Sitemap> {
  const publicStaticPages = getStaticSitemapPages();
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
      const config = getSingleSiteSitemapPageConfig(page);
      const url = buildCanonicalForPath(page, locale);
      const alternates = buildLanguagesForPath(page);
      const lastModified = contentDates.get(page);

      entries.push(
        createSitemapEntry({ url, lastModified, config, alternates }),
      );
    }
  }

  return entries;
}

/**
 * Dynamic sitemap generation for Next.js.
 * 按当前公开页面配置生成条目。
 */
export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return generateStaticPageEntries();
}
