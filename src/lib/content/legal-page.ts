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
  /** 正文渲染与 TOC 共用的同一次解析结果。 */
  blocks: readonly StaticMarkdownBlock[];
  headings: HeadingItem[];
}

export function loadLegalPage(
  slug: string,
  locale: Locale,
): LegalPageData {
  const page = getStaticPage(slug, locale);

  const metadata: LegalPageMetadata = {
    ...page.metadata,
    lastReviewed:
      page.metadata.lastReviewed ??
      page.metadata.updatedAt ??
      page.metadata.publishedAt,
  };

  // 单次 parse：blocks 直接交给正文渲染，headings 是同一批块的投影。
  const blocks = parseStaticMarkdownBlocks(page.content);
  const headings: HeadingItem[] = blocks.filter(isHeading).map((block) => ({
    level: block.level === "h2" ? (2 as const) : (3 as const),
    text: block.displayText,
    id: block.id,
  }));

  return { metadata, content: page.content, blocks, headings };
}
