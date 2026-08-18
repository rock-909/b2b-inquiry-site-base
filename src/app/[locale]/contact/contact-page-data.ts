import "server-only";

import {
  LAYER1_FACTS,
  extractFaqFromMetadata,
  generateFaqSchemaFromItems,
  interpolateFaqAnswer,
} from "@/lib/content/faq";
import { getContactCopyFromMessages } from "@/lib/contact/getContactCopy";
import { readRequiredMessagePath } from "@/lib/i18n/read-message-path";
import { getSourceMessages } from "@/lib/i18n/load-messages";
import { getStaticPage } from "@/lib/content/static-pages";
import type {
  FaqItem,
  Locale,
  Page,
  PageMetadata,
} from "@/types/content.types";

export interface ContactPageData {
  page: Page;
  messages: Record<string, unknown>;
  copy: ReturnType<typeof getContactCopyFromMessages>;
  faqItems: FaqItem[];
  faqSectionTitle: string;
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
  const messages = getSourceMessages(locale);
  const copy = getContactCopyFromMessages(messages);
  const faqItems: FaqItem[] = extractFaqFromMetadata(page.metadata).map(
    (item) => ({
      ...item,
      answer: interpolateFaqAnswer(item.answer, LAYER1_FACTS),
    }),
  );
  const faqSectionTitle = readRequiredMessagePath(messages, [
    "faq",
    "sectionTitle",
  ]);
  const faqSchema =
    faqItems.length > 0 ? generateFaqSchemaFromItems(faqItems, locale) : null;

  return {
    page,
    messages,
    copy,
    faqItems,
    faqSectionTitle,
    faqSchema,
  };
}
