/**
 * Static Markdown Content Renderer
 *
 * Renders lightweight static markdown content into React elements.
 * Supports headings, lists, tables, and inline bold text.
 */

import type { ReactNode } from "react";
import { InlineMarkdown } from "@/lib/content/inline-markdown";

const BOLD_WRAPPER_LENGTH = 2;
const H2_PREFIX_LENGTH = 3;
const H3_PREFIX_LENGTH = 4;
const LIST_ITEM_PREFIX_LENGTH = 2;
const EXPLICIT_ID_PATTERN = /\s*\\?\{#([a-z0-9-]+)\\?\}\s*$/;

interface StaticListItem {
  readonly key: string;
  readonly content: ReactNode;
}

function slugifyHeading(text: string): string {
  const trimmed = text.trim();
  if (trimmed === "") {
    return "";
  }

  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function parseHeadingId(text: string): {
  displayText: string;
  id: string;
} {
  const match = EXPLICIT_ID_PATTERN.exec(text);
  if (match) {
    return {
      displayText: text.slice(0, match.index).trim(),
      id: match[1] ?? "",
    };
  }
  return { displayText: text, id: slugifyHeading(text) };
}

interface RenderState {
  elements: ReactNode[];
  listItems: StaticListItem[];
  listItemIndex: number;
  listType: "ordered" | "unordered" | null;
  tableRows: string[][];
  tableHeaders: string[];
  inTable: boolean;
  index: number;
}

function createListElement(state: RenderState): ReactNode | null {
  if (state.listItems.length === 0) return null;

  const className =
    "mt-3 max-w-[72ch] list-inside space-y-1 text-base leading-7 text-muted-foreground";
  if (state.listType === "ordered") {
    return (
      <ol key={`ol-${state.index}`} className={`${className} list-decimal`}>
        {state.listItems.map((item) => (
          <li key={item.key}>{item.content}</li>
        ))}
      </ol>
    );
  }

  return (
    <ul key={`ul-${state.index}`} className={`${className} list-disc`}>
      {state.listItems.map((item) => (
        <li key={item.key}>{item.content}</li>
      ))}
    </ul>
  );
}

function createTableElement(state: RenderState): ReactNode | null {
  if (state.tableRows.length === 0 || state.tableHeaders.length === 0) {
    return null;
  }

  return (
    <div key={`table-${state.index}`} className="relative mt-4">
      {/* Mobile cue that wide tables scroll instead of silently clipping. */}
      <div
        aria-hidden
        className="from-background pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l to-transparent md:hidden"
      />
      <div
        aria-label={state.tableHeaders.filter(Boolean).join(", ")}
        className="overflow-x-auto [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        data-scrollable-table="true"
        role="region"
        tabIndex={0}
      >
        <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            {state.tableHeaders.map((header, headerIndex) => (
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
          {state.tableRows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`} className="border-b last:border-0">
              {state.tableHeaders.map((_header, cellIndex) => {
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

function flushList(state: RenderState): void {
  const el = createListElement(state);
  if (el) {
    state.elements.push(el);
    state.listItems = [];
    state.listItemIndex = 0;
    state.listType = null;
  }
}

function flushTable(state: RenderState): void {
  const el = createTableElement(state);
  if (el) {
    state.elements.push(el);
    state.tableHeaders = [];
    state.tableRows = [];
  }
  state.inTable = false;
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

function createInlineBoldParagraph(text: string, key: string): ReactNode {
  return (
    <p
      key={key}
      className="mt-3 max-w-[72ch] whitespace-pre-line text-base leading-7 text-muted-foreground"
    >
      <InlineMarkdown text={text} />
    </p>
  );
}

function handleTableLine(state: RenderState, trimmed: string): boolean {
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

function handleListLine(state: RenderState, trimmed: string): boolean {
  if (/^\d+\.\s/.test(trimmed)) {
    if (state.listType === "unordered") {
      flushList(state);
    }
    const text = trimmed.replace(/^\d+\.\s/, "");
    state.listType = "ordered";
    state.listItems.push({
      key: `ordered-${state.index}-${state.listItemIndex}`,
      content: <InlineMarkdown text={text} />,
    });
    state.listItemIndex += 1;
    return true;
  }

  if (trimmed.startsWith("- ")) {
    if (state.listType === "ordered") {
      flushList(state);
    }
    const text = trimmed.slice(LIST_ITEM_PREFIX_LENGTH);
    state.listType = "unordered";
    state.listItems.push({
      key: `unordered-${state.index}-${state.listItemIndex}`,
      content: <InlineMarkdown text={text} />,
    });
    state.listItemIndex += 1;
    return true;
  }

  return false;
}

function renderH2(state: RenderState, trimmed: string): void {
  const raw = trimmed.slice(H2_PREFIX_LENGTH).trim();
  const { displayText, id } = parseHeadingId(raw);
  state.elements.push(
    <h2
      key={`h2-${id || state.index}`}
      id={id || undefined}
      className="text-section mt-10 scroll-mt-24 text-foreground first:mt-0"
    >
      {displayText}
    </h2>,
  );
  state.index += 1;
}

function renderH3(state: RenderState, trimmed: string): void {
  const raw = trimmed.slice(H3_PREFIX_LENGTH).trim();
  const { displayText, id } = parseHeadingId(raw);
  state.elements.push(
    <h3
      key={`h3-${id || state.index}`}
      id={id || undefined}
      className="mt-6 scroll-mt-24 text-lg font-semibold text-foreground"
    >
      {displayText}
    </h3>,
  );
  state.index += 1;
}

function renderBoldParagraph(state: RenderState, trimmed: string): void {
  const text = trimmed.slice(BOLD_WRAPPER_LENGTH, -BOLD_WRAPPER_LENGTH);
  state.elements.push(
    <p
      key={`em-${state.index}`}
      className="mt-3 max-w-[72ch] text-base leading-7 font-medium text-foreground"
    >
      <InlineMarkdown text={text} />
    </p>,
  );
  state.index += 1;
}

function handleTextLine(state: RenderState, trimmed: string): void {
  flushList(state);
  flushTable(state);

  if (trimmed.startsWith("## ")) {
    renderH2(state, trimmed);
    return;
  }

  if (trimmed.startsWith("### ")) {
    renderH3(state, trimmed);
    return;
  }

  if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
    renderBoldParagraph(state, trimmed);
    return;
  }

  state.elements.push(createInlineBoldParagraph(trimmed, `p-${state.index}`));
  state.index += 1;
}

export function createStaticMarkdownContent(content: string): ReactNode {
  const lines = content.split("\n");
  const state: RenderState = {
    elements: [],
    listItems: [],
    listItemIndex: 0,
    listType: null,
    tableRows: [],
    tableHeaders: [],
    inTable: false,
    index: 0,
  };

  for (const line of lines) {
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

  return <>{state.elements}</>;
}
