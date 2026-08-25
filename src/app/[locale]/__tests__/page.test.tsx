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

// 首页现在内嵌真实表单区块；这里 mock 掉区块组件（表单行为由
// inquiry-form.test.tsx 与 e2e 证明），页面级只证明编排正确。
vi.mock("@/components/sections/inquiry-form-embed", () => ({
  EmbeddedInquiryFormSection: (props: Record<string, unknown>) => (
    <section
      data-testid="embedded-inquiry-section"
      data-title={props.title as string}
    />
  ),
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

  it("ends with the embedded inquiry form section", async () => {
    await renderPage();

    expect(screen.getByTestId("embedded-inquiry-section")).toHaveAttribute(
      "data-title",
      messages.home.finalCta.title,
    );
  });
});
