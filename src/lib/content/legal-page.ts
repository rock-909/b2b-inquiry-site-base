import { getStaticPage } from "@/lib/content/static-pages";
import {
  type StaticMarkdownBlock,
  parseStaticMarkdownBlocks,
} from "@/lib/content/static-markdown-blocks";
import type { LegalPageMetadata, Locale } from "@/types/content.types";

export interface HeadingItem {
  level: 2 | 3;
  text: string;
  id: string;
}

function isHeading(
  block: StaticMarkdownBlock,
): block is Extract<StaticMarkdownBlock, { kind: "heading" }> {
  return block.kind === "heading";
}

/**
 * 目录与正文共用同一份解析结果：heading 数据直接来自渲染所用的块序列，
 * 不再对同一内容做第二遍独立扫描。
 */
export function extractHeadingsFromContent(content: string): HeadingItem[] {
  return parseStaticMarkdownBlocks(content)
    .filter(isHeading)
    .map((block) => ({
      level: block.level === "h2" ? 2 : 3,
      text: block.displayText,
      id: block.id,
    }));
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
