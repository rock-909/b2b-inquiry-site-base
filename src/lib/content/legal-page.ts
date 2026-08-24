import { parseHeadingId } from "@/lib/content/heading-id";
import { getStaticPage } from "@/lib/content/static-pages";
import type { LegalPageMetadata, Locale } from "@/types/content.types";

export interface HeadingItem {
  level: 2 | 3;
  text: string;
  id: string;
}

const H2_PREFIX = "## ";
const H3_PREFIX = "### ";

export function extractHeadingsFromContent(content: string): HeadingItem[] {
  const headings: HeadingItem[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith(H3_PREFIX)) {
      const { displayText: text, id } = parseHeadingId(trimmed.slice(H3_PREFIX.length).trim());
      headings.push({ level: 3, text, id });
    } else if (trimmed.startsWith(H2_PREFIX)) {
      const { displayText: text, id } = parseHeadingId(trimmed.slice(H2_PREFIX.length).trim());
      headings.push({ level: 2, text, id });
    }
  }

  return headings;
}

interface LegalPageData {
  metadata: LegalPageMetadata;
  content: string;
  headings: HeadingItem[];
}

export function loadLegalPage(
  slug: string,
  locale: Locale,
): LegalPageData {
  const page = getStaticPage(slug, locale);

  const metadata: LegalPageMetadata = {
    ...page.metadata,
    // 本 loader 的全部消费方都是法律/参考文档页，统一 legal 布局 + TOC；
    // 源内容若声明其他 layout，这里会强制纠正并视为内容侧的笔误。
    layout: "legal",
    showToc: true,
    lastReviewed:
      page.metadata.lastReviewed ??
      page.metadata.updatedAt ??
      page.metadata.publishedAt,
  };

  const headings = extractHeadingsFromContent(page.content);

  return { metadata, content: page.content, headings };
}
