import { createLegalContent } from "@/lib/content/render-legal-content";

interface LegalContentRendererProps {
  content: string;
}

export function LegalContentRenderer({ content }: LegalContentRendererProps) {
  return <>{createLegalContent(content)}</>;
}
