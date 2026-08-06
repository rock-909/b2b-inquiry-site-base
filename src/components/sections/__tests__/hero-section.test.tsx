import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import messages from "../../../../messages/profiles/b2b-lead/en/messages.json";
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
    expect(screen.getByText(messages.home.hero.eyebrow)).toBeInTheDocument();
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

  it("does not render a product diagram or product proof panel", async () => {
    await renderHero();

    expect(screen.queryByTestId("hero-diagram")).not.toBeInTheDocument();
    expect(screen.queryByTestId("product-diagram")).not.toBeInTheDocument();
  });
});
