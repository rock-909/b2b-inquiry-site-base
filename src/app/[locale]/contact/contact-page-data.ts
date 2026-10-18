import "server-only";
import { getStaticPage } from "@/lib/content/static-pages";
import type { Locale, Page, PageMetadata } from "@/types/content.types";

function assertContactPageMetadata(
  metadata: unknown,
  locale: Locale,
): asserts metadata is PageMetadata {
  if (metadata === null || typeof metadata !== "object") {
    throw new Error(
      `Static contact page metadata invalid for locale: ${locale}`,
    );
  }

  const metadataRecord = metadata as Record<string, unknown>;

  for (const field of ["title", "slug", "publishedAt"] as const) {
    if (
      typeof metadataRecord[field] !== "string" ||
      metadataRecord[field].trim() === ""
    ) {
      throw new Error(
        `Static contact page metadata missing ${field} for locale: ${locale}`,
      );
    }
  }
}

export function getStaticContactPage(locale: Locale): Page {
  const page = getStaticPage("contact", locale);
  assertContactPageMetadata(page.metadata, locale);

  return page;
}
