import React from "react";
import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setRequestLocale } from "next-intl/server";
import ContactPage, { generateMetadata } from "@/app/[locale]/contact/page";
import { getStaticContactPage } from "@/app/[locale]/contact/contact-page-data";
import * as staticPages from "@/lib/content/static-pages";
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

vi.mock("@/lib/content/render-static-markdown-content", () => ({
  createStaticMarkdownContent: (content: string) => (
    <div data-testid="content-body">{content}</div>
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

    const content = await screen.findByTestId("contact-page-content");

    expect(
      within(content).getByRole("heading", { level: 1 }),
    ).toHaveTextContent("Contact");
    expect(screen.getByTestId("content-body")).toBeInTheDocument();
    expect(screen.getByTestId("inquiry-form")).toBeInTheDocument();
  });

  it("rejects invalid contact metadata before exposing page data", () => {
    const page = staticPages.getStaticPage("contact", "en");
    vi.spyOn(staticPages, "getStaticPage").mockReturnValue({
      ...page,
      metadata: { ...page.metadata, title: " " },
    });
    expect(() => getStaticContactPage("en")).toThrow(
      "Static contact page metadata missing title for locale: en",
    );
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
    expect(screen.queryByRole("button", { name: /send enquiry/i })).toBeNull();
    expect(
      screen.queryByTestId("contact-page-fallback"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("contact-page-content")).toBeInTheDocument();
    expect(screen.getByTestId("inquiry-form")).toBeInTheDocument();
  });

  it("sets the request locale in the page entry before rendering contact content", async () => {
    await ContactPage({
      params: Promise.resolve({ locale: "en" }),
    });

    expect(vi.mocked(setRequestLocale)).toHaveBeenCalledWith("en");
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

  it("does not render starter FAQ from page metadata", async () => {
    const page = await ContactPage({
      params: Promise.resolve({ locale: "en" }),
    });

    await renderAsyncPage(page as React.JSX.Element);

    expect(screen.queryByTestId("faq-section")).not.toBeInTheDocument();
  });

  it("does not protect the entire Contact page from browser translation", async () => {
    const page = await ContactPage({
      params: Promise.resolve({ locale: "en" }),
    });

    await renderAsyncPage(page as React.JSX.Element);
    const shell = screen.getByTestId("contact-page-content");

    expect(shell).not.toHaveClass("notranslate");
    expect(shell).not.toHaveAttribute("translate", "no");
  });

  it("builds contact metadata from the static content manifest", async () => {
    const enMetadata = await generateMetadata({
      params: Promise.resolve({ locale: "en" }),
    });

    expect(enMetadata.title).toBe("Contact — B2B Inquiry Site Reference");
    expect(enMetadata.description).toBe(
      "Reference contact page showing the minimum information a future business should replace.",
    );
    expect(enMetadata.other?.google).not.toBe("notranslate");
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
        locale: "en",
        type: "website",
      }),
    );
    expect(metadata.twitter).toEqual(
      expect.objectContaining({
        card: "summary_large_image",
        title: "Contact — B2B Inquiry Site Reference",
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
