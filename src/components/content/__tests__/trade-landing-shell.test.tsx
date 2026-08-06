import type React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TradeLandingShell } from "@/components/content/trade-landing-shell";

const mockJsonLdGraphScript = vi.hoisted(() => vi.fn());

vi.mock("@/components/seo/json-ld-script", () => ({
  JsonLdGraphScript: ({
    locale,
    data = [],
  }: {
    locale: string;
    data?: readonly unknown[];
  }) => {
    mockJsonLdGraphScript({ locale, data });
    return <script type="application/ld+json" data-testid="json-ld-graph" />;
  },
}));

vi.mock("@/components/content/legal-content-renderer", () => ({
  LegalContentRenderer: ({ content }: { content: string }) => (
    <div data-testid="trade-content">{content}</div>
  ),
}));

vi.mock("@/components/products/factory-pool-diagram", () => ({
  FactoryPoolDiagram: () => <div data-testid="factory-pool-diagram" />,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async ({ namespace }: { namespace: string }) => {
    const values: Record<string, Record<string, string>> = {
      oemLanding: {
        primaryCta: "Request a trade quote",
        secondaryCta: "See the five product lines",
        diagramLabel: "FACTORY POOL",
        diagramAriaLabel: "Factory pool diagram",
        diagramCaption: "Diagram caption",
        "diagramLabels.extrusion": "extrusion",
        "diagramLabels.moulding": "moulding",
        "diagramLabels.welding": "welding",
        "diagramLabels.sewing": "sewing",
        "diagramLabels.specAndQc": "one spec · one QC",
        "diagramLabels.mixedContainer": "one mixed container",
      },
      navigation: {
        home: "Home",
      },
      faq: {
        sectionTitle: "Frequently Asked Questions",
      },
    };

    return (key: string) => values[namespace]?.[key] ?? key;
  }),
}));

describe("TradeLandingShell", () => {
  beforeEach(() => {
    mockJsonLdGraphScript.mockClear();
  });

  it("Given OEM frontmatter FAQ, When the shell renders, Then visible FAQ comes from frontmatter only", async () => {
    const page = await TradeLandingShell({
      metadata: {
        title: "OEM, Private Label & Wholesale Supply",
        slug: "oem-wholesale",
        publishedAt: "2026-07-02",
        layout: "legal",
        showToc: true,
        lastReviewed: "2026-07-02",
        faq: [
          {
            id: "oem-faq-1",
            question: "Are you a factory or a trading company?",
            answer: "Neither — we're the product company.",
          },
          {
            id: "oem-faq-2",
            question: "What are your payment terms?",
            answer: "30% deposit, 70% before shipment (T/T).",
          },
        ],
      },
      content: "Factory pool overview without duplicated FAQ body copy.",
      locale: "en",
      pagePath: "/oem-wholesale",
    });

    render(page);

    expect(screen.getByTestId("faq-section")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "Are you a factory or a trading company?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "What are your payment terms?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("trade-content")).toHaveTextContent(
      "Factory pool overview without duplicated FAQ body copy.",
    );
    expect(screen.getByTestId("trade-content")).not.toHaveTextContent(
      "Neither — we're the product company.",
    );

    const graphCall = mockJsonLdGraphScript.mock.calls.at(-1)?.[0] as
      | { data: readonly unknown[] }
      | undefined;
    const faqPage = graphCall?.data.find(
      (node) =>
        typeof node === "object" &&
        node !== null &&
        (node as { "@type"?: string })["@type"] === "FAQPage",
    ) as { mainEntity?: Array<{ name?: string }> } | undefined;

    expect(faqPage?.mainEntity).toHaveLength(2);
    expect(faqPage?.mainEntity?.[0]?.name).toBe(
      "Are you a factory or a trading company?",
    );
  });
});
