/**
 * Static Markdown Content Renderer
 *
 * 解析与渲染分离：先把 markdown 文本解析为不可变的块列表（parse 阶段），
 * 再把块映射为 React 元素（render 阶段）。目录（TOC）与正文共用同一个
 * 解析结果的数据形状，保证锚点永远不会漂移。
 *
 * 支持的语法：H2/H3 标题（含 {#anchor} 显式 id）、有序/无序列表、管道表格、
 * **加粗** 段落，以及行内加粗与内部链接（InlineMarkdown）。
 */

import { parseHeadingId } from "@/lib/content/heading-id";

const BOLD_WRAPPER_LENGTH = 2;

export type StaticMarkdownBlock =
  | {
      kind: "heading";
      level: "h2" | "h3";
      displayText: string;
      id: string;
    }
  | {
      kind: "paragraph";
      text: string;
      emphasized: boolean;
    }
  | {
      kind: "list";
      ordered: boolean;
      items: string[];
    }
  | {
      kind: "table";
      headers: string[];
      rows: string[][];
    };

interface ParseState {
  blocks: StaticMarkdownBlock[];
  listItems: string[];
  listOrdered: boolean | null;
  tableHeaders: string[];
  tableRows: string[][];
  inTable: boolean;
}

function parseTableRow(line: string): string[] {
  return line
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(cells: string[]): boolean {
  return cells.every((cell) => /^-+$/.test(cell));
}

function flushList(state: ParseState): void {
  if (state.listItems.length > 0) {
    state.blocks.push({
      kind: "list",
      ordered: state.listOrdered === true,
      items: state.listItems,
    });
    state.listItems = [];
    state.listOrdered = null;
  }
}

function flushTable(state: ParseState): void {
  // 与既有行为一致：缺 header 或缺 body 的残表整体丢弃。
  if (state.tableRows.length > 0 && state.tableHeaders.length > 0) {
    state.blocks.push({
      kind: "table",
      headers: state.tableHeaders,
      rows: state.tableRows,
    });
    state.tableHeaders = [];
    state.tableRows = [];
  }
  state.inTable = false;
}

function handleTableLine(state: ParseState, trimmed: string): boolean {
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return false;
  }

  flushList(state);
  const cells = parseTableRow(trimmed);

  if (isTableSeparator(cells)) {
    state.inTable = true;
    return true;
  }

  if (!state.inTable && state.tableHeaders.length === 0) {
    state.tableHeaders = cells;
  } else {
    state.tableRows.push(cells);
  }
  return true;
}

function handleListLine(state: ParseState, trimmed: string): boolean {
  const orderedMatch = /^(\d+)\.\s/.exec(trimmed);
  const isUnordered = trimmed.startsWith("- ");

  let text: string;
  let ordered: boolean;
  if (orderedMatch) {
    text = trimmed.slice(orderedMatch[0].length);
    ordered = true;
  } else if (isUnordered) {
    text = trimmed.slice(2);
    ordered = false;
  } else {
    return false;
  }

  if (state.listOrdered !== null && state.listOrdered !== ordered) {
    flushList(state);
  }

  if (state.listItems.length === 0) {
    state.listOrdered = ordered;
  }
  state.listItems.push(text);
  return true;
}

function handleHeadingLine(
  state: ParseState,
  level: "h2" | "h3",
  prefixLength: number,
  trimmed: string,
): void {
  const raw = trimmed.slice(prefixLength).trim();
  const { displayText, id } = parseHeadingId(raw);
  state.blocks.push({ kind: "heading", level, displayText, id });
}

function handleTextLine(state: ParseState, trimmed: string): void {
  flushList(state);
  flushTable(state);

  if (trimmed.startsWith("## ")) {
    handleHeadingLine(state, "h2", 3, trimmed);
    return;
  }

  if (trimmed.startsWith("### ")) {
    handleHeadingLine(state, "h3", 4, trimmed);
    return;
  }

  if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
    state.blocks.push({
      kind: "paragraph",
      text: trimmed.slice(BOLD_WRAPPER_LENGTH, -BOLD_WRAPPER_LENGTH),
      emphasized: true,
    });
    return;
  }

  state.blocks.push({ kind: "paragraph", text: trimmed, emphasized: false });
}

/** 把静态 markdown 文本解析成不可变的块序列（纯函数，供渲染与 TOC 共用）。 */
export function parseStaticMarkdownBlocks(content: string): StaticMarkdownBlock[] {
  const state: ParseState = {
    blocks: [],
    listItems: [],
    listOrdered: null,
    tableHeaders: [],
    tableRows: [],
    inTable: false,
  };

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    if (trimmed === "") {
      flushList(state);
      if (!state.inTable) {
        flushTable(state);
      }
      continue;
    }

    if (handleTableLine(state, trimmed)) {
      continue;
    }

    if (state.inTable) {
      flushTable(state);
    }

    if (handleListLine(state, trimmed)) {
      continue;
    }

    handleTextLine(state, trimmed);
  }

  flushList(state);
  flushTable(state);

  return state.blocks;
}
