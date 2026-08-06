import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionHead } from "@/components/ui/section-head";

describe("SectionHead", () => {
  it("renders a single semantic h2 with the text-section class by default", () => {
    render(
      <SectionHead title="Product overview" subtitle="Five product lines" />,
    );

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Product overview",
    });

    expect(heading.tagName).toBe("H2");
    expect(heading).toHaveClass("text-section");
    expect(screen.getByText("Five product lines")).toBeInTheDocument();
  });

  it("keeps the action visible beside the same semantic h2", () => {
    render(
      <SectionHead
        title="Related products"
        action={<a href="/products">View all</a>}
      />,
    );

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Related products",
    });

    expect(heading).toHaveClass("text-section");
    expect(screen.getByRole("link", { name: "View all" })).toBeVisible();
  });
});
