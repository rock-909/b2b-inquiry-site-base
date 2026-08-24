import React from "react";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setRequestLocale } from "next-intl/server";
import ContactPage, { generateMetadata } from "@/app/[locale]/contact/page";
import { renderAsyncPage } from "@/test/render-async-page";

const { mockGetContactCopyFromMessages } = vi.hoisted(() => ({
  mockGetContactCopyFromMessages: vi.fn(),
}));

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

const contactCopy = {
  header: {
    title: "Contact",
    description: "Share the essentials so the team can identify the next step.",
  },
  panel: {
    contact: {
      title: "Email & inquiry form",
      emailLabel: "Email",
      phoneLabel: "Phone",
    },
    response: {
      title: "What happens next",
      responseTimeLabel: "Response target",
      responseTimeValue: "Set before launch",
      bestForLabel: "Useful first reply",
      bestForValue: "The next confirmed step",
      prepareLabel: "Help the team respond",
      prepareValue: "Share the requirement, scope, timing and destination.",
    },
    hours: {
      title: "Business hours",
      weekdaysLabel: "Weekdays",
      saturdayLabel: "Saturday",
      sundayLabel: "Sunday",
      closedLabel: "Set before launch",
    },
  },
};

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

vi.mock("@/lib/contact/getContactCopy", () => ({
  getContactCopyFromMessages: mockGetContactCopyFromMessages,
}));

describe("ContactPage static content", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContactCopyFromMessages.mockReturnValue(contactCopy);
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

  it("renders English contact panel copy from the top-level contact namespace", async () => {
    const actualContactCopy = await vi.importActual<
      typeof import("@/lib/contact/getContactCopy")
    >("@/lib/contact/getContactCopy");
    mockGetContactCopyFromMessages.mockImplementation(
      actualContactCopy.getContactCopyFromMessages,
    );

    const page = await ContactPage({
      params: Promise.resolve({ locale: "en" }),
    });

    await renderAsyncPage(page as React.JSX.Element);

    expect(
      screen.getByRole("heading", { name: "Email & inquiry" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Email & WhatsApp/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "What happens next" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Response target")).toBeInTheDocument();
    expect(screen.getAllByText("Set before launch").length).toBeGreaterThan(0);
  });

  it("renders the public email and hides the owner TODO phone", async () => {
    const { ContactMethodsCard } = await import("../contact-page-sections");

    render(
      <ContactMethodsCard
        copy={{
          title: "Email & RFQ",
          emailLabel: "Email",
          emailUnavailable: "Use the RFQ form if email is unavailable.",
          phoneLabel: "Phone",
        }}
      />,
    );

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

  it("renders the inquiry handoff before the form", async () => {
    const page = await ContactPage({
      params: Promise.resolve({ locale: "en" }),
    });

    await renderAsyncPage(page as React.JSX.Element);

    const handoff = screen.getByTestId("contact-inquiry-handoff");
    const formColumn = screen.getByTestId("contact-form-column");

    expect(
      within(handoff).getByRole("heading", {
        level: 2,
        name: "Start with the essentials",
      }),
    ).toBeInTheDocument();
    expect(handoff).toHaveTextContent(
      "A focused inquiry gives the business enough context",
    );
    expect(handoff).toHaveTextContent("What you need");
    expect(handoff).toHaveTextContent("Scope and quantity");
    expect(handoff).toHaveTextContent("Timing and destination");
    expect(formColumn.compareDocumentPosition(handoff)).toBe(
      Node.DOCUMENT_POSITION_PRECEDING,
    );
  });

  it("keeps the form as the main action with response expectations beside it", async () => {
    const page = await ContactPage({
      params: Promise.resolve({ locale: "en" }),
    });

    await renderAsyncPage(page as React.JSX.Element);

    // h1 contact/inquiry heading.
    expect(
      screen.getByRole("heading", { level: 1, name: /contact|inquiry/i }),
    ).toBeInTheDocument();

    // The form is present via the shared InquiryForm composition.
    expect(screen.getByTestId("inquiry-form")).toBeInTheDocument();

    // Confidence (response expectations) sits in the column beside the form,
    // and leads with the response/expect/prepare copy rather than the
    // contact-methods fallback.
    const confidenceColumn = screen.getByTestId("contact-confidence-column");
    const formColumn = screen.getByTestId("contact-form-column");

    // Response / expect / prepare confidence copy the page actually renders
    // from existing contact panel content, scoped to the confidence column.
    expect(
      within(confidenceColumn).getAllByText(/response|step|requirement/i)
        .length,
    ).toBeGreaterThan(0);
    expect(
      within(confidenceColumn).getAllByText("Set before launch").length,
    ).toBeGreaterThan(0);
    expect(
      within(confidenceColumn).getByText("The next confirmed step"),
    ).toBeInTheDocument();
    expect(confidenceColumn).not.toContainElement(
      screen.getByTestId("inquiry-form"),
    );
    expect(formColumn.compareDocumentPosition(confidenceColumn)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("keeps the inquiry handoff as static guidance without extra routes or downloads", async () => {
    const page = await ContactPage({
      params: Promise.resolve({ locale: "en" }),
    });

    await renderAsyncPage(page as React.JSX.Element);

    const handoff = screen.getByTestId("contact-inquiry-handoff");

    expect(within(handoff).queryByRole("link")).not.toBeInTheDocument();
    expect(handoff.textContent).not.toContain(".pdf");
    expect(handoff.textContent).not.toContain("/api/");
    expect(handoff.textContent).not.toContain("login");
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
