/**
 * Content Manifest Loader
 *
 * Provides utilities to query the content manifest for static Markdown rendering.
 * Uses static import from generated TypeScript file - no runtime fs dependency.
 */

import type { Locale } from "@/types/content.types";
import {
  CONTENT_MANIFEST,
  type ContentEntry,
} from "./content-manifest.generated";

export type { ContentEntry };

export function resolveOptionalContentEntry(
  locale: Locale,
  slug: string,
): ContentEntry | undefined {
  return CONTENT_MANIFEST.byKey[`pages/${locale}/${slug}`];
}
