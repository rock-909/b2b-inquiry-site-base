import type { ReactNode } from "react";
import { Link } from "@/i18n/routing";
import { createMarkdownLinkPattern } from "@/lib/content/inline-markdown-text";

const BOLD_WRAPPER_LENGTH = 2;

// Last path segment has an extension, e.g. /downloads/catalog.pdf?v=2.
const PUBLIC_FILE_PATH = /^\/[^?#]*\.[a-z0-9]+(?:[?#]|$)/iu;

interface InlineMarkdownProps {
  readonly text: string;
}

function MarkdownLink({ href, label }: { href: string; label: string }) {
  if (href.startsWith("/") && !PUBLIC_FILE_PATH.test(href)) {
    return (
      <Link href={href} className="text-link">
        {label}
      </Link>
    );
  }

  // public/ files are served only without a locale prefix, so they and
  // external URLs bypass next-intl's Link.
  const isExternal = !href.startsWith("/");
  return (
    <a
      href={href}
      className="text-link"
      {...(isExternal && { target: "_blank", rel: "noopener noreferrer" })}
    >
      {label}
    </a>
  );
}

/** Renders `[label](/path)` and `[label](https://...)` links inside plain text. */
function LinkifiedText({ text }: InlineMarkdownProps): ReactNode {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(createMarkdownLinkPattern())) {
    const [fullMatch, label = "", href = ""] = match;
    const { index } = match;

    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index));
    }

    nodes.push(<MarkdownLink key={`link-${index}`} href={href} label={label} />);

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
