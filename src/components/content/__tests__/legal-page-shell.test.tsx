import { render, screen } from "@testing-library/react";
import { Children, isValidElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  buildShellPageSchema,
  LegalPageShell,
} from "@/components/content/legal-page-shell";
import { JsonLdGraphScript } from "@/components/seo/json-ld-script";
import type { FaqItem } from "@/types/content.types";

vi.mock("@/config/single-site", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/single-site")>();
  return {
    ...actual,
    SINGLE_SITE_CONFIG: {
      ...actual.SINGLE_SITE_CONFIG,
      baseUrl: "https://www.example.com",
    },
  };
});

describe("LegalPageShell structured data", () => {
  it("Given privacy legal metadata, When the shell renders, Then WebPage JSON-LD uses the page URL graph", async () => {
    const pageUrl = "https://www.example.com/privacy";
    const schema = await buildShellPageSchema({
      metadata: {
        title: "Privacy Policy",
        slug: "privacy",
        publishedAt: "2024-01-01",
        seo: {
          title: "Privacy Policy",
          description: "Privacy description",
        },
      },
      locale: "en",
      pageUrl,
    });

    expect(schema).toMatchObject({
      "@type": "WebPage",
      "@id": pageUrl,
      url: pageUrl,
      isPartOf: { "@id": "https://www.example.com#website" },
    });
    // 页面不显示日期，JSON-LD 也不能声明。
    expect(schema).not.toHaveProperty("datePublished");
    expect(schema).not.toHaveProperty("dateModified");
  });
});

async function renderShell(faq: FaqItem[] | undefined) {
  const shell = (await LegalPageShell({
    metadata: {
      title: "Contact",
      slug: "contact",
      publishedAt: "2024-01-01",
      ...(faq && { faq }),
    },
    blocks: [],
    headings: [],
    locale: "en",
    pagePath: "/contact",
  })) as ReactElement<{ children: ReactElement[] }>;
  const [jsonLd, body] = Children.toArray(shell.props.children).filter(
    isValidElement,
  ) as [ReactElement<Parameters<typeof JsonLdGraphScript>[0]>, ReactElement];
  expect(jsonLd.type).toBe(JsonLdGraphScript);

  render(
    <>
      {await JsonLdGraphScript(jsonLd.props)}
      {body}
    </>,
  );
  const script = document.querySelector('script[type="application/ld+json"]');
  const graph = JSON.parse(script?.textContent ?? "{}") as {
    "@graph": Array<Record<string, unknown>>;
  };
  return graph["@graph"];
}

describe("LegalPageShell FAQ", () => {
  it("shows every question and answer on the page and as a FAQPage node", async () => {
    const graph = await renderShell([
      { id: "moq", question: "What is your MOQ?", answer: "500 units per SKU." },
      { id: "lead", question: "How long is lead time?", answer: "About 30 days." },
    ]);

    expect(
      screen.getByRole("heading", { level: 2, name: "Frequently asked questions" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual(["What is your MOQ?", "How long is lead time?"]);
    expect(screen.getByText("500 units per SKU.")).toBeVisible();

    expect(graph.find((node) => node["@type"] === "FAQPage")).toEqual({
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is your MOQ?",
          acceptedAnswer: { "@type": "Answer", text: "500 units per SKU." },
        },
        {
          "@type": "Question",
          name: "How long is lead time?",
          acceptedAnswer: { "@type": "Answer", text: "About 30 days." },
        },
      ],
    });
  });

  it.each([{ faq: undefined }, { faq: [] }])(
    "renders no FAQ section or node for faq=$faq",
    async ({ faq }) => {
    const graph = await renderShell(faq);

    expect(screen.queryByText("Frequently asked questions")).not.toBeInTheDocument();
    expect(graph.some((node) => node["@type"] === "FAQPage")).toBe(false);
    },
  );
});
