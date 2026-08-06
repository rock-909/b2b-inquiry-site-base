import type { ReactNode } from "react";
import { Link } from "@/i18n/routing";
import { createInternalLinkPattern } from "@/lib/content/inline-markdown-text";

const BOLD_WRAPPER_LENGTH = 2;

interface InlineMarkdownProps {
  readonly text: string;
}

/** Renders internal `[label](/path)` links inside otherwise-plain text. */
function LinkifiedText({ text }: InlineMarkdownProps): ReactNode {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(createInternalLinkPattern())) {
    const [fullMatch, label = "", href = ""] = match;
    const { index } = match;

    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index));
    }

    nodes.push(
      <Link
        key={`link-${index}`}
        href={href}
        className="text-[var(--primary-text)] font-medium underline underline-offset-4 hover:no-underline"
      >
        {label}
      </Link>,
    );

    lastIndex = index + fullMatch.length;
  }

  if (lastIndex === 0) {
    return text;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/**
 * Bold splits first so `**[label](/path)**` nests cleanly; links are then
 * parsed inside each bold or plain segment.
 */
export function InlineMarkdown({ text }: InlineMarkdownProps): ReactNode {
  let cursor = 0;

  return text.split(/(\*\*[^*]+\*\*)/g).flatMap((part) => {
    const key = `${cursor}-${part}`;
    cursor += part.length;

    if (part.length === 0) {
      return [];
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(BOLD_WRAPPER_LENGTH, -BOLD_WRAPPER_LENGTH);
      return (
        <strong key={key} className="font-medium text-foreground">
          <LinkifiedText text={inner} />
        </strong>
      );
    }

    return <LinkifiedText key={key} text={part} />;
  });
}
