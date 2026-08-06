import { FaqAccordion } from "@/components/sections/faq-accordion";
import { SectionHead } from "@/components/ui/section-head";

export interface FaqSectionItem {
  key: string;
  question: string;
  answer: string;
}

export interface FaqSectionViewProps {
  title: string;
  subtitle?: string;
  items: FaqSectionItem[];
}

export function FaqSectionView({
  title,
  subtitle,
  items,
}: FaqSectionViewProps) {
  return (
    <section className="section-divider py-14 md:py-[72px]">
      <div className="mx-auto max-w-[1080px] px-6">
        <SectionHead title={title} {...(subtitle ? { subtitle } : {})} />
        <FaqAccordion items={items} />
      </div>
    </section>
  );
}
