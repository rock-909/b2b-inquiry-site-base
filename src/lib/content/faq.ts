import { stripInlineMarkdown } from "@/lib/content/inline-markdown-text";
import type { FaqItem } from "@/types/content.types";

export function extractFaqFromMetadata(
  metadata: { faq?: unknown },
): FaqItem[] {
  const { faq } = metadata;
  if (!Array.isArray(faq)) return [];

  return faq.filter(
    (item): item is FaqItem =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as FaqItem).id === "string" &&
      typeof (item as FaqItem).question === "string" &&
      typeof (item as FaqItem).answer === "string",
  );
}

interface FaqSchemaQuestion {
  "@type": "Question";
  name: string;
  acceptedAnswer: {
    "@type": "Answer";
    text: string;
  };
}

interface FaqSchema {
  "@type": "FAQPage";
  inLanguage: string;
  mainEntity: FaqSchemaQuestion[];
}

export function generateFaqSchemaFromItems(
  items: FaqItem[],
  locale: string,
): FaqSchema {
  return {
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: stripInlineMarkdown(item.answer),
      },
    })),
  };
}
