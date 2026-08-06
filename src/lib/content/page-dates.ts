import { getMdxPageSlugByStaticPath } from "@/config/pages.config";
import { routing } from "@/i18n/routing";
import { resolveOptionalContentEntry } from "@/lib/content-manifest";
import { logger } from "@/lib/logger";

const MDX_PAGE_SLUGS: Record<string, string> = getMdxPageSlugByStaticPath();

export function isMdxDrivenPage(path: string): boolean {
  return path in MDX_PAGE_SLUGS;
}

export function getMdxPageLastModified(path: string): Promise<Date> {
  return Promise.resolve().then(() => {
    const slug = MDX_PAGE_SLUGS[path];
    if (slug === undefined) {
      throw new Error(`No MDX slug mapping for path: ${path}`);
    }

    const results = routing.locales.map((locale) => {
      try {
        const entry = resolveOptionalContentEntry(locale, slug);
        if (entry === undefined) {
          throw new Error(`Content not found: ${slug}`);
        }
        const metadata = entry.metadata as {
          publishedAt?: unknown;
          updatedAt?: unknown;
        };
        const dateStr = metadata.updatedAt ?? metadata.publishedAt;
        if (typeof dateStr !== "string") {
          throw new Error(`No valid date found for slug: ${slug}`);
        }
        return new Date(dateStr);
      } catch (error) {
        logger.warn("MDX page missing for locale", { slug, locale, error });
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
