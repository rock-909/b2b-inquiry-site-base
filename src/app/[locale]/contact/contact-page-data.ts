import "server-only";

import {
  extractFaqFromMetadata,
  generateFaqSchemaFromItems,
} from "@/lib/content/faq";
import { getSiteMessageValues } from "@/lib/i18n/site-message-values";
import { interpolate } from "@/lib/interpolate";
import { getStaticPage } from "@/lib/content/static-pages";
import type {
  FaqItem,
  Locale,
  Page,
  PageMetadata,
} from "@/types/content.types";

export interface ContactPageData {
  page: Page;
  faqItems: FaqItem[];
  faqSchema: ReturnType<typeof generateFaqSchemaFromItems> | null;
}

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

export function getContactPageData(locale: Locale): ContactPageData {
  const page = getStaticContactPage(locale);
  const siteValues = getSiteMessageValues();
  const faqItems: FaqItem[] = extractFaqFromMetadata(page.metadata).map(
    (item) => ({
      ...item,
      answer: interpolate(item.answer, siteValues),
    }),
  );
  const faqSchema =
    faqItems.length > 0 ? generateFaqSchemaFromItems(faqItems, locale) : null;

  return {
    page,
    faqItems,
    faqSchema,
  };
}
