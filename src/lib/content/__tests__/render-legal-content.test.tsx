import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderStaticMarkdownBlocks } from "@/lib/content/render-static-markdown-content";
import { parseStaticMarkdownBlocks } from "@/lib/content/static-markdown-blocks";

function renderMarkdown(content: string) {
  return renderStaticMarkdownBlocks(parseStaticMarkdownBlocks(content));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("static markdown rendering", () => {
  it("does not carry an incomplete table header into the next table", () => {
    render(<>{renderMarkdown(
      "| Abandoned |\n\nParagraph\n\n| Region |\n| --- |\n| EU |",
    )}</>);
    expect(screen.getByRole("columnheader", { name: "Region" })).toBeVisible();
    expect(screen.queryByText("Abandoned")).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "EU" })).toBeVisible();
  });

  it("treats alignment rows as the table separator, not as data", () => {
    render(<>{renderMarkdown("| Region | Days |\n|:--|--:|\n| EU | 30 |")}</>);
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.queryByText(":--")).not.toBeInTheDocument();
  });

  it("renders inline bold inside list items without literal markdown markers", () => {
    const { container } = render(
      <>
        {renderMarkdown(
          "- **Email inquiries**: Response within one business day",
        )}
      </>,
    );

    expect(screen.getByText("Email inquiries")).toHaveTextContent(
      "Email inquiries",
    );
    expect(container).not.toHaveTextContent("**");
  });

  it("preserves ordered-list semantics for numbered markdown lists", () => {
    const { container } = render(
      <>
        {renderMarkdown(
          [
            "1. Replace the business facts",
            "2. Review the public story",
            "3. Connect the lead path",
          ].join("\n"),
        )}
      </>,
    );

    expect(container.querySelector("ol")).not.toBeNull();
    expect(container.querySelector("ul")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("renders explicit heading anchors without leaking marker text", () => {
    const { container } = render(
      <>{renderMarkdown("## Privacy Scope \\{#privacy-scope\\}")}</>,
    );

    const heading = container.querySelector("h2");
    expect(heading).toHaveAttribute("id", "privacy-scope");
    expect(heading).toHaveTextContent("Privacy Scope");
    expect(container).not.toHaveTextContent("{#privacy-scope}");
  });

  it("generates stable heading ids when content has no explicit anchor", () => {
    const { container } = render(
      <>{renderMarkdown("### Data Protection Basics")}</>,
    );

    expect(container.querySelector("h3")).toHaveAttribute(
      "id",
      "data-protection-basics",
    );
  });

  it("renders markdown tables with semantic table structure", () => {
    render(
      <>
        {renderMarkdown(
          [
            "| Region | Standard |",
            "| --- | --- |",
            "| EU | GDPR |",
            "| US | CCPA |",
          ].join("\n"),
        )}
      </>,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Region" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "GDPR" })).toBeVisible();
  });

  it("makes markdown tables keyboard reachable with header context", () => {
    render(
      <>
        {renderMarkdown(
          [
            "| Region | Standard |",
            "| --- | --- |",
            "| EU | GDPR |",
          ].join("\n"),
        )}
      </>,
    );

    expect(
      screen.getByRole("region", { name: "Region, Standard" }),
    ).toHaveAttribute("tabindex", "0");
  });

  it("omits empty table headers from the region label", () => {
    render(
      <>
        {renderMarkdown(
          ["| | Standard |", "| --- | --- |", "| EU | GDPR |"].join("\n"),
        )}
      </>,
    );

    expect(
      screen.getByRole("region", { name: /^Standard$/u }),
    ).toHaveAttribute("tabindex", "0");
  });

  it("flushes lists and tables before following paragraphs", () => {
    render(
      <>
        {renderMarkdown(
          [
            "- First item",
            "- Second item",
            "",
            "| Key | Value |",
            "| --- | --- |",
            "| SLA | 24h |",
            "",
            "Plain follow-up paragraph",
          ].join("\n"),
        )}
      </>,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Plain follow-up paragraph")).toBeVisible();
  });

  it("renders repeated paragraph text without duplicate React key warnings", () => {
    render(
      <>
        {renderMarkdown(
          ["You have the right to:", "", "You have the right to:"].join("\n"),
        )}
      </>,
    );

    expect(screen.getAllByText("You have the right to:")).toHaveLength(2);
  });
});

describe("parseStaticMarkdownBlocks heading ids", () => {
  const headingIds = (markdown: string) =>
    parseStaticMarkdownBlocks(markdown).flatMap((block) =>
      block.kind === "heading" ? [block.id] : [],
    );

  it("keeps letters from non-Latin scripts and drops accents", () => {
    expect(
      headingIds(
        [
          "## Información que recopilamos",
          "## Политика конфиденциальности",
          "## プライバシー",
          "## 隐私政策",
        ].join("\n"),
      ),
    ).toEqual([
      "informacion-que-recopilamos",
      "политика-конфиденциальности",
      "プライバシー",
      "隐私政策",
    ]);
  });

  it("suffixes repeated headings so every anchor id is unique", () => {
    expect(headingIds("## Scope\n## Scope\n### Scope\n## ¿?")).toEqual([
      "scope",
      "scope-2",
      "scope-3",
      "section",
    ]);
  });
});
