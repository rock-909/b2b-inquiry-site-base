import { InlineMarkdown } from "@/lib/content/inline-markdown";

interface FaqAccordionProps {
  items: Array<{
    key: string;
    question: string;
    answer: string;
  }>;
}

function FaqChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  return (
    <div
      className="divide-y-0 rounded-lg border-0 bg-card shadow-card"
      data-testid="faq-accordion"
    >
      {items.map((item) => (
        <details
          key={item.key}
          className="group border-t border-b-0 border-border first:border-t-0"
        >
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 text-left text-[15px] font-medium text-muted-foreground transition-colors group-open:text-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            <span data-testid={`faq-question-${item.key}`} translate="no">
              {item.question}
            </span>
            <FaqChevronIcon />
          </summary>
          <div className="px-6 pb-4">
            <p
              className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground"
              data-testid={`faq-answer-${item.key}`}
            >
              <InlineMarkdown text={item.answer} />
            </p>
          </div>
        </details>
      ))}
    </div>
  );
}
