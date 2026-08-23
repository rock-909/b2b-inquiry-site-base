import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import messages from "../../../../messages/base/en/messages.json";
import { HeroSection } from "@/components/sections/hero-section";

async function renderHero() {
  render(await HeroSection());
}

describe("HeroSection", () => {
  it("renders the neutral reference copy", async () => {
    await renderHero();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      messages.home.hero.title,
    );
    expect(screen.getByText(messages.home.hero.subtitle)).toBeInTheDocument();
  });

  it("links the primary inquiry action and secondary about action", async () => {
    await renderHero();

    expect(
      screen.getByRole("link", { name: messages.home.hero.cta.primary }),
    ).toHaveAttribute("href", "/request-quote");
    expect(
      screen.getByRole("link", { name: messages.home.hero.cta.secondary }),
    ).toHaveAttribute("href", "/about");
  });

  it("states the post-submit expectation next to the primary action", async () => {
    await renderHero();

    expect(screen.getByText(messages.home.hero.ctaNote)).toBeInTheDocument();
  });

  it("renders the fact sheet with honest placeholder rows", async () => {
    await renderHero();

    const sheet = screen.getByTestId("hero-fact-sheet");
    expect(sheet).toHaveAccessibleName(messages.home.hero.factSheet.label);
    expect(
      screen.getByText(messages.home.hero.factSheet.responseTarget.term),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.home.hero.factSheet.workflow.value),
    ).toBeInTheDocument();
  });

  it("does not render a product diagram or product proof panel", async () => {
    await renderHero();

    expect(screen.queryByTestId("hero-diagram")).not.toBeInTheDocument();
    expect(screen.queryByTestId("product-diagram")).not.toBeInTheDocument();
  });
});
