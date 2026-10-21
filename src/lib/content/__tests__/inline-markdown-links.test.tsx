import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InlineMarkdown } from "@/lib/content/inline-markdown";

// Renders as a Spanish page: next-intl's Link prefixes every href with /es.
vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={`/es${href}`} {...props}>
      {children}
    </a>
  ),
}));

describe("InlineMarkdown links on a Spanish page", () => {
  it("keeps the locale prefix on page links", () => {
    render(<p><InlineMarkdown text="See [about us](/about)." /></p>);
    expect(screen.getByRole("link", { name: "about us" })).toHaveAttribute(
      "href",
      "/es/about",
    );
  });

  // public/ files are only served unprefixed; /es/catalog.pdf is a 404.
  it("links public files without the locale prefix", () => {
    render(
      <p>
        <InlineMarkdown text="Download the [catalog](/downloads/catalog.pdf) or [specs](/specs.pdf?v=2#page=3)." />
      </p>,
    );
    expect(screen.getByRole("link", { name: "catalog" })).toHaveAttribute(
      "href",
      "/downloads/catalog.pdf",
    );
    expect(screen.getByRole("link", { name: "specs" })).toHaveAttribute(
      "href",
      "/specs.pdf?v=2#page=3",
    );
  });

  it("links external urls in a new tab without leaking the opener", () => {
    render(
      <p>
        <InlineMarkdown text="Verified by the [certification body](https://example.com/cert)." />
      </p>,
    );
    const link = screen.getByRole("link", { name: "certification body" });
    expect(link).toHaveAttribute("href", "https://example.com/cert");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByText(/\]\(/)).not.toBeInTheDocument();
  });
});
