import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../../messages/base/en/messages.json";
import HomePage, { generateMetadata } from "@/app/[locale]/page";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";

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

describe("home page metadata", () => {
  it("localizes Spanish search and social metadata while preserving the brand", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "es" }),
    });

    expect(metadata.title).toBe(
      `${SINGLE_SITE_CONFIG.name} - Plantilla de consultas B2B`,
    );
    expect(metadata.description).toBe(
      "Un sitio de referencia de consultas B2B no destinado a producción, con identidad, dominio y datos de contacto de ejemplo.",
    );
    expect(metadata.openGraph).toMatchObject({
      title: metadata.title,
      description: metadata.description,
      siteName: SINGLE_SITE_CONFIG.name,
      locale: "es",
    });
    expect(metadata.twitter).toMatchObject({
      title: metadata.title,
      description: metadata.description,
    });
    expect(metadata.alternates).toMatchObject({
      canonical: new URL("/es", SINGLE_SITE_CONFIG.baseUrl).toString(),
      languages: {
        en: new URL("/", SINGLE_SITE_CONFIG.baseUrl).toString(),
        es: new URL("/es", SINGLE_SITE_CONFIG.baseUrl).toString(),
        "x-default": new URL("/", SINGLE_SITE_CONFIG.baseUrl).toString(),
      },
    });
  });

  it("preserves English homepage metadata", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en" }),
    });

    expect(metadata.title).toBe(SINGLE_SITE_CONFIG.seo.defaultTitle);
    expect(metadata.description).toBe(
      SINGLE_SITE_CONFIG.seo.defaultDescription,
    );
  });
});
