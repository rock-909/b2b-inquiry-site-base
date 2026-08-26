import { createStaticMarkdownContent } from "@/lib/content/render-static-markdown-content";

interface LegalContentRendererProps {
  content: string;
}

export function LegalContentRenderer({ content }: LegalContentRendererProps) {
  return <>{createStaticMarkdownContent(content)}</>;
}
