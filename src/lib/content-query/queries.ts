/**
 * 内容查询函数
 */

import { cache } from "react";
import type { Locale, Page, PageMetadata } from "@/types/content.types";
import { resolveOptionalContentEntry } from "@/lib/content-manifest";

/**
 * Get page by slug
 */
export const getPageBySlug = cache(
  (slug: string, locale?: Locale): Promise<Page> => {
    return Promise.resolve().then(() => {
      if (locale === undefined) {
        throw new Error(`Content not found: ${slug}`);
      }

      const entry = resolveOptionalContentEntry(locale, slug);

      if (entry === undefined) {
        throw new Error(`Content not found: ${slug}`);
      }

      return {
        slug: entry.slug,
        metadata: entry.metadata as unknown as PageMetadata,
        content: entry.content,
        filePath: entry.filePath,
      };
    });
  },
);
