import type { ReactNode } from "react";
import { createStaticMarkdownContent } from "@/lib/content/render-static-markdown-content";

export function createLegalContent(content: string): ReactNode {
  return createStaticMarkdownContent(content);
}
