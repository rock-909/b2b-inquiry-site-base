import { getStaticContentPageSlugByPath } from "@/config/pages.config";
import type { Locale } from "@/i18n/routing-config";
import { getOptionalStaticPage } from "@/lib/content/static-pages";
import { logger } from "@/lib/logger";

const STATIC_CONTENT_PAGE_SLUGS = getStaticContentPageSlugByPath();

export function isStaticContentPage(path: string): boolean {
  return path in STATIC_CONTENT_PAGE_SLUGS;
}

/** 该语言版本内容的最后修改日期；缺内容或日期无效时不输出 lastmod。 */
export function getStaticContentPageLastModified(
  path: string,
  locale: Locale,
): Date | undefined {
  const slug = STATIC_CONTENT_PAGE_SLUGS[path];
  if (slug === undefined) {
    throw new Error(`No static content slug mapping for path: ${path}`);
  }

  const metadata = getOptionalStaticPage(slug, locale)?.metadata;
  const date = new Date(metadata?.updatedAt ?? metadata?.publishedAt ?? "");
  if (Number.isNaN(date.getTime())) {
    logger.warn("Static content page missing or invalid for locale", {
      slug,
      locale,
    });
    return undefined;
  }
  return date;
}
