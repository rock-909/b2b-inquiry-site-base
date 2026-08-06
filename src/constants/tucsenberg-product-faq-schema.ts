import type { TucsenbergProductPage } from "@/constants/tucsenberg-product-pages";
import { generateFaqSchemaFromItems } from "@/lib/content/mdx-faq";

export function buildTucsenbergProductFaqSchema(
  page: TucsenbergProductPage,
  locale: string,
): ReturnType<typeof generateFaqSchemaFromItems> {
  return generateFaqSchemaFromItems(
    page.faqs.map((faq, index) => ({
      id: `${page.slug}-faq-${index + 1}`,
      question: faq.question,
      answer: faq.answer,
    })),
    locale,
  );
}
