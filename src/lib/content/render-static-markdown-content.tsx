/**
 * Static Markdown Content Renderer
 *
 * 渲染入口：parseStaticMarkdownBlocks 产出的块序列 -> React 元素。
 * 解析规则与 TOC 提取共用同一份数据形状（见 static-markdown-blocks.ts）。
 */

import type { ReactNode } from "react";
import { InlineMarkdown } from "@/lib/content/inline-markdown";
import {
  parseStaticMarkdownBlocks,
  type StaticMarkdownBlock,
} from "@/lib/content/static-markdown-blocks";

const LIST_CLASS_NAME =
  "mt-3 max-w-[72ch] list-inside space-y-1 text-base leading-7 text-muted-foreground";

function renderHeading(
  block: Extract<StaticMarkdownBlock, { kind: "heading" }>,
  key: string,
): ReactNode {
  if (block.level === "h2") {
    return (
      <h2
        key={key}
        id={block.id || undefined}
        className="text-section mt-10 scroll-mt-24 text-foreground first:mt-0"
      >
        {block.displayText}
      </h2>
    );
  }

  return (
    <h3
      key={key}
      id={block.id || undefined}
      className="mt-6 scroll-mt-24 text-lg font-semibold text-foreground"
    >
      {block.displayText}
    </h3>
  );
}

function renderParagraph(
  block: Extract<StaticMarkdownBlock, { kind: "paragraph" }>,
  key: string,
): ReactNode {
  if (block.emphasized) {
    return (
      <p
        key={key}
        className="mt-3 max-w-[72ch] text-base leading-7 font-medium text-foreground"
      >
        <InlineMarkdown text={block.text} />
      </p>
    );
  }

  return (
    <p
      key={key}
      className="mt-3 max-w-[72ch] whitespace-pre-line text-base leading-7 text-muted-foreground"
    >
      <InlineMarkdown text={block.text} />
    </p>
  );
}

function renderList(
  block: Extract<StaticMarkdownBlock, { kind: "list" }>,
  key: string,
): ReactNode {
  const items = block.items.map((item, itemIndex) => (
    <li key={`li-${itemIndex}`}>{<InlineMarkdown text={item} />}</li>
  ));

  if (block.ordered) {
    return (
      <ol key={key} className={`${LIST_CLASS_NAME} list-decimal`}>
        {items}
      </ol>
    );
  }

  return (
    <ul key={key} className={`${LIST_CLASS_NAME} list-disc`}>
      {items}
    </ul>
  );
}

function renderTable(
  block: Extract<StaticMarkdownBlock, { kind: "table" }>,
  key: string,
): ReactNode {
  return (
    <div key={key} className="relative mt-4">
      {/* Mobile cue that wide tables scroll instead of silently clipping. */}
      <div
        aria-hidden
        className="from-background pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l to-transparent md:hidden"
      />
      <div
        aria-label={block.headers.filter(Boolean).join(", ")}
        className="overflow-x-auto [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        data-scrollable-table="true"
        role="region"
        tabIndex={0}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              {block.headers.map((header, headerIndex) => (
                <th
                  key={`header-${headerIndex}`}
                  className="px-3 py-2 text-left font-medium text-foreground"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} className="border-b last:border-0">
                {block.headers.map((_header, cellIndex) => {
                  const cell = row[cellIndex] ?? "";
                  return (
                    <td
                      key={`cell-${rowIndex}-${cellIndex}`}
                      className="px-3 py-2 text-muted-foreground"
                    >
                      <InlineMarkdown text={cell} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 把块序列映射成 React 元素（无状态、纯渲染）。 */
export function createStaticMarkdownContent(content: string): ReactNode {
  const blocks = parseStaticMarkdownBlocks(content);

  return (
    <>
      {blocks.map((block, blockIndex) => {
        const key = `${block.kind}-${blockIndex}`;
        switch (block.kind) {
          case "heading":
            return renderHeading(block, key);
          case "paragraph":
            return renderParagraph(block, key);
          case "list":
            return renderList(block, key);
          case "table":
            return renderTable(block, key);
          default:
            return null;
        }
      })}
    </>
  );
}
