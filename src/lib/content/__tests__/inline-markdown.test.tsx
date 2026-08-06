import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InlineMarkdown } from "@/lib/content/inline-markdown";
import { stripInlineMarkdown } from "@/lib/content/inline-markdown-text";

describe("InlineMarkdown", () => {
  it("renders plain text unchanged", () => {
    render(<p><InlineMarkdown text="Plain factory copy." /></p>);
    expect(screen.getByText("Plain factory copy.")).toBeInTheDocument();
  });

  it("renders bold segments", () => {
    render(<p><InlineMarkdown text="Quoted **within 12 hours** always." /></p>);
    expect(screen.getByText("within 12 hours")).toBeInTheDocument();
    expect(screen.getByText("within 12 hours").tagName).toBe("STRONG");
  });

  it("renders internal links as anchors", () => {
    render(
      <p>
        <InlineMarkdown text="See [OEM & wholesale](/oem-wholesale) for private label." />
      </p>,
    );
    const link = screen.getByRole("link", { name: "OEM & wholesale" });
    expect(link).toHaveAttribute("href", "/oem-wholesale");
  });

  it("renders bold text around links in the same string", () => {
    render(
      <p>
        <InlineMarkdown text="**Full terms** in [warranty](/warranty) apply." />
      </p>,
    );
    expect(screen.getByText("Full terms").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "warranty" })).toHaveAttribute(
      "href",
      "/warranty",
    );
  });

  it("renders links nested inside bold segments", () => {
    render(
      <p>
        <InlineMarkdown text="**[Start your trade quote →](/request-quote)**" />
      </p>,
    );
    const link = screen.getByRole("link", {
      name: "Start your trade quote →",
    });
    expect(link).toHaveAttribute("href", "/request-quote");
    expect(link.closest("strong")).not.toBeNull();
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });

  it("does not link external urls", () => {
    render(
      <p>
        <InlineMarkdown text="Ignore [external](https://example.com) syntax." />
      </p>,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("stripInlineMarkdown", () => {
  it("removes bold markers and unwraps internal links", () => {
    expect(
      stripInlineMarkdown("3 years on **materials**. [Full terms](/warranty)."),
    ).toBe("3 years on materials. Full terms.");
  });

  it("leaves plain text unchanged", () => {
    expect(stripInlineMarkdown("Plain answer.")).toBe("Plain answer.");
  });
});
