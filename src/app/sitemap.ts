import type { MetadataRoute } from "next";
import {
  getStaticContentPageLastModified,
  isStaticContentPage,
} from "@/lib/content/page-dates";
import { getStaticSitemapPages } from "@/config/pages.config";
import { routing } from "@/i18n/routing";
import {
  buildCanonicalForPath,
  buildLanguagesForPath,
} from "@/lib/seo-metadata";

/**
 * 按当前公开页面配置生成条目。changefreq 与 priority 被 Google 忽略，不输出。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return routing.locales.flatMap((locale) =>
    getStaticSitemapPages().map((page) => {
      const lastModified = isStaticContentPage(page)
        ? getStaticContentPageLastModified(page, locale)
        : undefined;
      return {
        url: buildCanonicalForPath(page, locale),
        ...(lastModified ? { lastModified } : {}),
        alternates: { languages: buildLanguagesForPath(page) },
      };
    }),
  );
}
