import "server-only";

import {
  LAYER1_FACTS,
  extractFaqFromMetadata,
  generateFaqSchemaFromItems,
  interpolateFaqAnswer,
} from "@/lib/content/mdx-faq";
import { getContactCopyFromMessages } from "@/lib/contact/getContactCopy";
import { CONTENT_MANIFEST } from "@/lib/content-manifest.generated";
import { readRequiredMessagePath } from "@/lib/i18n/read-message-path";
import { getComposedMessages } from "@/lib/i18n/composed-messages";
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
  const entry = CONTENT_MANIFEST.byKey[`pages/${locale}/contact`];

  if (entry === undefined) {
    throw new Error(`Static contact page not found for locale: ${locale}`);
  }

  assertContactPageMetadata(entry.metadata, locale);

  const page: Page = {
    slug: entry.slug,
    filePath: entry.filePath,
    metadata: entry.metadata,
    content: entry.content,
  };

  return page;
}

export function getContactPageData(locale: Locale): ContactPageData {
  const page = getStaticContactPage(locale);
  const messages = getComposedMessages(locale);
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
