import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InlineMarkdown } from "@/lib/content/inline-markdown";

describe("InlineMarkdown", () => {
  it("renders plain text unchanged", () => {
    render(<p><InlineMarkdown text="Plain supplier copy." /></p>);
    expect(screen.getByText("Plain supplier copy.")).toBeInTheDocument();
  });

  it("renders bold segments", () => {
    render(<p><InlineMarkdown text="Keep **important details** visible." /></p>);
    expect(screen.getByText("important details")).toBeInTheDocument();
    expect(screen.getByText("important details").tagName).toBe("STRONG");
  });

  it("renders internal links as anchors", () => {
    render(
      <p>
        <InlineMarkdown text="See [how the business works](/about) for context." />
      </p>,
    );
    const link = screen.getByRole("link", { name: "how the business works" });
    expect(link).toHaveAttribute("href", "/about");
  });

  it("renders bold text around links in the same string", () => {
    render(
      <p>
        <InlineMarkdown text="**Full details** are in the [terms](/terms)." />
      </p>,
    );
    expect(screen.getByText("Full details").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "terms" })).toHaveAttribute(
      "href",
      "/terms",
    );
  });

  it("renders links nested inside bold segments", () => {
    render(
      <p>
        <InlineMarkdown text="**[Start your trade quote →](/contact)**" />
      </p>,
    );
    const link = screen.getByRole("link", {
      name: "Start your trade quote →",
    });
    expect(link).toHaveAttribute("href", "/contact");
    expect(link.closest("strong")).not.toBeNull();
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });
});
