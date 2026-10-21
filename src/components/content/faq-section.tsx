import type { ReactNode } from "react";
import type { FaqItem } from "@/types/content.types";

interface FaqSectionProps {
  heading: string;
  items: readonly FaqItem[] | undefined;
}

/** Page FAQ as plain server HTML: every answer is visible, no accordion. */
export function FaqSection({ heading, items }: FaqSectionProps): ReactNode {
  if (!items?.length) {
    return null;
  }

  return (
    <section aria-labelledby="page-faq" className="mt-12">
      <h2 id="page-faq" className="text-section scroll-mt-24 text-foreground">
        {heading}
      </h2>
      {items.map((item) => (
        <div key={item.id}>
          <h3 className="mt-6 text-lg font-semibold text-foreground">
            {item.question}
          </h3>
          <p className="mt-2 max-w-[72ch] whitespace-pre-line text-base leading-7 text-muted-foreground">
            {item.answer}
          </p>
        </div>
      ))}
    </section>
  );
}
