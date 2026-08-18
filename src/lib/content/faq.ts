import { SINGLE_SITE_FACTS } from "@/config/single-site";
import { stripInlineMarkdown } from "@/lib/content/inline-markdown-text";
import { interpolate } from "@/lib/interpolate";
import type { FaqItem } from "@/types/content.types";

export const LAYER1_FACTS: Record<string, string | number> = {
  companyName: SINGLE_SITE_FACTS.company.name,
  established: SINGLE_SITE_FACTS.company.established,
};

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

export function interpolateFaqAnswer(
  answer: string,
  facts: Record<string, string | number>,
): string {
  return interpolate(answer, facts);
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
  "@context": string;
  "@type": "FAQPage";
  inLanguage: string;
  mainEntity: FaqSchemaQuestion[];
}

export function generateFaqSchemaFromItems(
  items: FaqItem[],
  locale: string,
): FaqSchema {
  return {
    "@context": "https://schema.org",
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
