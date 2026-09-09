import { getStaticContentPageSlugByPath } from "@/config/pages.config";
import { routing } from "@/i18n/routing";
import { getOptionalStaticPage } from "@/lib/content/static-pages";
import { logger } from "@/lib/logger";

const STATIC_CONTENT_PAGE_SLUGS = getStaticContentPageSlugByPath();

export function isStaticContentPage(path: string): boolean {
  return path in STATIC_CONTENT_PAGE_SLUGS;
}

export function getStaticContentPageLastModified(path: string): Promise<Date> {
  return Promise.resolve().then(() => {
    const slug = STATIC_CONTENT_PAGE_SLUGS[path];
    if (slug === undefined) {
      throw new Error(`No static content slug mapping for path: ${path}`);
    }

    const results = routing.locales.map((locale) => {
      try {
        const entry = getOptionalStaticPage(slug, locale);
        if (entry === undefined) {
          throw new Error(`Content not found: ${slug}`);
        }
        const metadata = entry.metadata as {
          publishedAt?: unknown;
          updatedAt?: unknown;
        };
        const dateStr = metadata.updatedAt ?? metadata.publishedAt;
        if (typeof dateStr !== "string" || Number.isNaN(Date.parse(dateStr))) {
          throw new Error(`No valid date found for slug: ${slug}`);
        }
        return new Date(dateStr);
      } catch (error) {
        logger.warn("Static content page missing or invalid for locale", {
          slug,
          locale,
          error,
        });
        return new Date(0);
      }
    });

    const latest = results.reduce((a, b) => (a > b ? a : b), new Date(0));

    if (latest.getTime() === 0) {
      throw new Error(`No content found for slug: ${slug}`);
    }

    return latest;
  });
}
