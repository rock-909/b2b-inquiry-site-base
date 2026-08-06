import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLegalContent } from "@/lib/content/render-legal-content";
import { createStaticMarkdownContent } from "@/lib/content/render-static-markdown-content";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createStaticMarkdownContent", () => {
  it("renders inline bold inside list items without literal markdown markers", () => {
    const { container } = render(
      <>
        {createStaticMarkdownContent(
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
        {createStaticMarkdownContent(
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
      <>{createStaticMarkdownContent("## Privacy Scope \\{#privacy-scope\\}")}</>,
    );

    const heading = container.querySelector("h2");
    expect(heading).toHaveAttribute("id", "privacy-scope");
    expect(heading).toHaveClass("text-section");
    expect(heading).toHaveTextContent("Privacy Scope");
    expect(container).not.toHaveTextContent("{#privacy-scope}");
  });

  it("generates stable heading ids when content has no explicit anchor", () => {
    const { container } = render(
      <>{createStaticMarkdownContent("### Data Protection Basics")}</>,
    );

    expect(container.querySelector("h3")).toHaveAttribute(
      "id",
      "data-protection-basics",
    );
  });

  it("renders markdown tables with semantic table structure", () => {
    render(
      <>
        {createStaticMarkdownContent(
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
        {createStaticMarkdownContent(
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
        {createStaticMarkdownContent(
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
        {createStaticMarkdownContent(
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
        {createStaticMarkdownContent(
          ["You have the right to:", "", "You have the right to:"].join("\n"),
        )}
      </>,
    );

    expect(screen.getAllByText("You have the right to:")).toHaveLength(2);
  });
});

describe("createLegalContent", () => {
  it("keeps the legal renderer as a thin wrapper around static markdown rendering", () => {
    const { container } = render(<>{createLegalContent("## Privacy")}</>);

    expect(container.querySelector("h2")).toHaveTextContent("Privacy");
  });
});

describe("static markdown renderer ownership", () => {
  it("keeps the generic renderer independent and legal rendering as a wrapper", () => {
    const genericSource = readFileSync(
      "src/lib/content/render-static-markdown-content.tsx",
      "utf8",
    );
    const legalSource = readFileSync(
      "src/lib/content/render-legal-content.tsx",
      "utf8",
    );

    expect(genericSource).not.toContain("render-legal-content");
    expect(legalSource).toContain("render-static-markdown-content");
    expect(legalSource).toContain("createStaticMarkdownContent(content)");
  });
});
