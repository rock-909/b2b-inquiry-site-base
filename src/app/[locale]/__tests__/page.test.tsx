import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../../messages/base/en/messages.json";
import HomePage from "@/app/[locale]/page";

vi.mock("@/components/sections/hero-section", () => ({
  HeroSection: () => (
    <section>
      <h1>{messages.home.hero.title}</h1>
    </section>
  ),
}));

vi.mock("@/components/seo/json-ld-script", () => ({
  JsonLdGraphScript: () => null,
}));

async function renderPage() {
  render(await HomePage({ params: Promise.resolve({ locale: "en" }) }));
}

describe("home page", () => {
  it("renders the neutral hero and value section", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      messages.home.hero.title,
    );
    expect(
      screen.getByRole("heading", { name: messages.home.value.title }),
    ).toBeInTheDocument();
  });

  it("ends with the inquiry action", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", { name: messages.home.finalCta.title }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", {
          name: messages.home.finalCta.primary,
        })
        .at(-1),
    ).toHaveAttribute("href", "/request-quote");
  });
});
