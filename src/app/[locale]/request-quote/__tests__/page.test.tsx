import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ValidatedInquiryContext } from "@/lib/lead-pipeline/inquiry-handoff";
import RequestQuotePage, { generateMetadata } from "../page";

const { mockGenerateMetadataForPath, mockJsonLdGraphScript, capturedInquiry } =
  vi.hoisted(() => ({
    mockGenerateMetadataForPath: vi.fn(async () => ({
      title: "Request a Quote",
      description: "Request a quote",
    })),
    mockJsonLdGraphScript: vi.fn(),
    capturedInquiry: {
      latest: null as { context: ValidatedInquiryContext } | null,
    },
  }));

vi.mock("next-intl/server", async () => {
  const { getComposedMessages } = await import("@/lib/i18n/composed-messages");
  const enMessages = getComposedMessages("en") as Record<string, unknown>;
  const requestQuote = enMessages.requestQuote as Record<string, unknown>;
  const inquiryForm = enMessages.inquiry as { form: Record<string, unknown> };

  function getNestedString(
    messages: Record<string, unknown>,
    keyPath: string,
  ): string {
    const value = keyPath.split(".").reduce<unknown>((current, key) => {
      if (
        typeof current !== "object" ||
        current === null ||
        Array.isArray(current)
      ) {
        return undefined;
      }
      return (current as Record<string, unknown>)[key];
    }, messages);

    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Missing RFQ test message: ${keyPath}`);
    }

    return value;
  }

  return {
    setRequestLocale: vi.fn(),
    getTranslations: vi.fn(
      async ({
        namespace,
      }: {
        locale?: string;
        namespace:
          "requestQuote.metadata" | "requestQuote.page" | "inquiry.form";
      }) => {
        if (namespace === "requestQuote.metadata") {
          return (key: string) =>
            getNestedString(
              requestQuote.metadata as Record<string, unknown>,
              key,
            );
        }
        if (namespace === "inquiry.form") {
          return (key: string) => getNestedString(inquiryForm.form, key);
        }

        return (key: string, values?: Record<string, string | number>) => {
          const message = getNestedString(
            requestQuote.page as Record<string, unknown>,
            key,
          );
          return Object.entries(values ?? {}).reduce(
            (current, [token, value]) => {
              return current.split(`{${token}}`).join(String(value));
            },
            message,
          );
        };
      },
    ),
  };
});

vi.mock("@/lib/seo-metadata", () => ({
  generateMetadataForPath: mockGenerateMetadataForPath,
}));

vi.mock("@/components/seo/json-ld-script", () => ({
  JsonLdGraphScript: ({
    locale,
    data = [],
  }: {
    locale: string;
    data?: readonly unknown[];
  }) => {
    mockJsonLdGraphScript({ locale, data });
    return null;
  },
}));

vi.mock("@/components/forms/inquiry-form", () => ({
  InquiryForm: ({ context }: { context: ValidatedInquiryContext }) => {
    capturedInquiry.latest = { context };
    return <div data-testid="mock-inquiry-form" />;
  },
}));

async function renderPageWith(
  searchParams: Record<string, string | string[] | undefined>,
) {
  render(
    await RequestQuotePage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve(searchParams),
    }),
  );
}

describe("RequestQuotePage", () => {
  beforeEach(() => {
    mockGenerateMetadataForPath.mockClear();
    mockJsonLdGraphScript.mockClear();
    capturedInquiry.latest = null;
  });

  it("uses the owner-approved RFQ meta title", async () => {
    await generateMetadata({
      params: Promise.resolve({ locale: "en" }),
    });

    expect(mockGenerateMetadataForPath).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          title: "Request a Quote — Reply Within 12 Hours",
        }),
      }),
    );
  });

  it("renders the owner-approved RFQ page shell and success copy", async () => {
    const page = await RequestQuotePage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({}),
    });

    render(page);

    expect(
      screen.getByRole("heading", { level: 1, name: "Get real numbers" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Received\. We reply within 12 hours\. If the details are sufficient, the reply includes a quote\. Otherwise, we ask only for the missing essentials\./u,
      ),
    ).toBeInTheDocument();
  });

  it("injects request-quote WebPage JSON-LD through the shared graph script", async () => {
    const page = await RequestQuotePage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({}),
    });

    render(page);

    expect(mockJsonLdGraphScript).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "en",
        data: [
          expect.objectContaining({
            "@type": "WebPage",
            name: "Request a Quote — Reply Within 12 Hours",
            url: expect.stringMatching(/\/request-quote$/u),
            isPartOf: expect.objectContaining({
              "@id": expect.stringMatching(/#website$/u),
            }),
            about: expect.objectContaining({
              "@id": expect.stringMatching(/#organization$/u),
            }),
          }),
        ],
      }),
    );
  });

  it("passes catalog-context for a valid catalogProductId", async () => {
    await renderPageWith({ catalogProductId: "frp-flood-barriers" });

    expect(capturedInquiry.latest?.context).toEqual({
      kind: "catalog-context",
      catalogProductId: "frp-flood-barriers",
      displayLabel: "FRP Composite Planks",
    });
  });

  it("downgrades forged or repeated catalogProductId values to general-context", async () => {
    await renderPageWith({ catalogProductId: "forged-product" });
    expect(capturedInquiry.latest?.context).toEqual({
      kind: "general-context",
    });

    await renderPageWith({
      catalogProductId: ["abs-flood-barriers", "frp-flood-barriers"],
    });
    expect(capturedInquiry.latest?.context).toEqual({
      kind: "general-context",
    });
  });

  it("passes estimator config into the validated initial message", async () => {
    await renderPageWith({
      catalogProductId: "abs-flood-barriers",
      config: "Estimated 12 straight units",
    });

    expect(capturedInquiry.latest?.context).toEqual(
      expect.objectContaining({
        initialMessage: "Estimated 12 straight units",
      }),
    );
  });

  it("defaults missing search params to general-context", async () => {
    await renderPageWith({});

    expect(capturedInquiry.latest?.context).toEqual({
      kind: "general-context",
    });
  });
});
