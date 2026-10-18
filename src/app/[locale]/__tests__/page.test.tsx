import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../../messages/base/en/messages.json";
import HomePage, { generateMetadata } from "@/app/[locale]/page";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";

vi.mock("@/components/seo/json-ld-script", () => ({
  JsonLdGraphScript: () => null,
}));

describe("home page", () => {
  it("renders a localized heading and ordinary contact link without a form", async () => {
    render(await HomePage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      messages.home.title,
    );
    expect(
      screen.getByRole("link", { name: messages.home.contactLink }),
    ).toHaveAttribute("href", "/contact");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
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
