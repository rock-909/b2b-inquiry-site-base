import React from "react";
import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContactPage, { generateMetadata } from "@/app/[locale]/contact/page";
import contactContent from "@/content/pages/en/contact";
import { renderAsyncPage } from "@/test/render-async-page";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof React>("react");

  return {
    ...actual,
    Suspense: ({
      children,
      fallback,
    }: {
      children: React.ReactNode;
      fallback?: React.ReactNode;
    }) => (
      <section data-testid="suspense-boundary">
        {fallback ? (
          <div data-testid="suspense-fallback">{fallback}</div>
        ) : null}
        {children}
      </section>
    ),
  };
});

vi.mock("@/components/forms/inquiry-form", () => ({
  InquiryForm: ({
    copy,
    fallback,
  }: {
    copy: unknown;
    fallback: React.ReactNode;
  }) => (
    <section data-testid="inquiry-form" data-has-copy={copy ? "true" : "false"}>
      {fallback}
    </section>
  ),
}));

describe("ContactPage static content", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders hero and body from static content while keeping the form", async () => {
    const page = await ContactPage({
      params: Promise.resolve({ locale: "en" }),
    });

    await renderAsyncPage(page as React.JSX.Element);

    expect(
      await screen.findByRole("heading", { level: 1 }),
    ).toHaveTextContent(contactContent.metadata.title);
    expect(screen.getByRole("article")).not.toBeEmptyDOMElement();
    expect(screen.getByTestId("inquiry-form")).toBeInTheDocument();
  });

  it("keeps the no-JS inquiry fallback inside the form column", async () => {
    const page = await ContactPage({
      params: Promise.resolve({ locale: "en" }),
    });

    await renderAsyncPage(page as React.JSX.Element);

    const formColumn = screen.getByTestId("contact-form-column");
    const staticFallback = within(formColumn).getByTestId(
      "inquiry-form-static-fallback",
    );

    expect(staticFallback).toBeInTheDocument();
    expect(staticFallback.tagName).not.toBe("FORM");
    expect(staticFallback.querySelector("form")).toBeNull();
    expect(within(staticFallback).queryByRole("link")).toBeNull();
    expect(
      screen.queryByTestId("contact-page-fallback"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("inquiry-form")).toBeInTheDocument();
  });

  it("renders the public email and hides the owner TODO phone", async () => {
    const { ContactMethodsCard } = await import("../contact-page-sections");

    await renderAsyncPage(<ContactMethodsCard locale="en" />);

    expect(screen.queryByText("sales@example.invalid")).not.toBeInTheDocument();
    expect(screen.queryByText("+86-518-0000-0000")).not.toBeInTheDocument();
    expect(screen.queryByText("TODO-OWNER")).not.toBeInTheDocument();
    expect(screen.queryByText("Phone")).not.toBeInTheDocument();
    expect(screen.queryByText(/WhatsApp/i)).not.toBeInTheDocument();
  });

  it("builds contact metadata from the static content manifest", async () => {
    const enMetadata = await generateMetadata({
      params: Promise.resolve({ locale: "en" }),
    });

    expect(enMetadata.title).toBe(contactContent.metadata.seo.title);
    expect(enMetadata.description).toBe(
      contactContent.metadata.seo.description,
    );
  });

  it("generates runtime SEO metadata for the actual localized contact route", async () => {
    vi.stubEnv("APP_ENV", "production");

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en" }),
    });

    expect(metadata.alternates).toEqual(
      expect.objectContaining({
        canonical: "https://example.com/contact",
        languages: expect.objectContaining({
          en: "https://example.com/contact",
          "x-default": "https://example.com/contact",
        }),
      }),
    );
    expect(metadata.openGraph).toEqual(
      expect.objectContaining({
        url: "https://example.com/contact",
        locale: "en_US",
        type: "website",
      }),
    );
    expect(metadata.twitter).toEqual(
      expect.objectContaining({
        card: "summary_large_image",
        title: contactContent.metadata.seo.title,
      }),
    );
    expect(metadata.robots).toEqual(
      expect.objectContaining({
        index: true,
        follow: true,
      }),
    );
  });
});
