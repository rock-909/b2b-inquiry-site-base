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
    title: "Legacy Contact",
    description: "Legacy description",
  },
  panel: {
    contact: {
      title: "Email & WhatsApp",
      emailLabel: "Email",
      phoneLabel: "Phone",
    },
    response: {
      title: "What happens next",
      responseTimeLabel: "Reply within",
      responseTimeValue: "12 hours",
      bestForLabel: "Quote when",
      bestForValue: "Details are sufficient",
      prepareLabel: "Fastest route",
      prepareValue: "Use the RFQ form; it asks the questions we'd ask anyway.",
    },
    hours: {
      title: "Time zone",
      weekdaysLabel: "China",
      saturdayLabel: "Follow-up",
      sundayLabel: "US/EU hours",
      closedLabel: "Closed",
    },
  },
};

vi.mock("@/components/forms/inquiry-form", () => ({
  InquiryForm: ({
    source,
    context,
    copy,
    fallback,
  }: {
    source: string;
    context: { kind: string };
    copy: unknown;
    fallback: React.ReactNode;
  }) => (
    <section
      data-testid="inquiry-form"
      data-source={source}
      data-context-kind={context.kind}
      data-has-copy={copy ? "true" : "false"}
    >
      {fallback}
    </section>
  ),
}));

vi.mock("@/lib/content/render-static-markdown-content", () => ({
  createStaticMarkdownContent: (content: string) => (
    <div data-testid="mdx-body">{content}</div>
  ),
}));

vi.mock("@/lib/contact/getContactCopy", () => ({
  getContactCopyFromMessages: mockGetContactCopyFromMessages,
}));

describe("ContactPage MDX migration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContactCopyFromMessages.mockReturnValue(contactCopy);
  });

  it("renders hero and body from MDX while keeping the form", async () => {
    const page = await ContactPage({
      params: Promise.resolve({ locale: "en" }),
    });

    await renderAsyncPage(page as React.JSX.Element);

    const content = await screen.findByTestId("contact-page-content");

    expect(
      within(content).getByRole("heading", { level: 1 }),
    ).toHaveTextContent("Contact");
    expect(screen.getByTestId("mdx-body")).toBeInTheDocument();
    expect(screen.getByTestId("inquiry-form")).toBeInTheDocument();
    expect(screen.getByTestId("inquiry-form")).toHaveAttribute(
      "data-source",
      "contact",
    );
    expect(screen.getByTestId("inquiry-form")).toHaveAttribute(
      "data-context-kind",
      "general-context",
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
    expect(within(staticFallback).getByRole("link")).toHaveAttribute(
      "href",
      expect.stringMatching(/^mailto:/),
    );
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
      screen.getByRole("heading", { name: "Email & RFQ" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Email & WhatsApp/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "What happens next" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Reply within")).toBeInTheDocument();
    expect(screen.getByText("12 hours")).toBeInTheDocument();
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

    expect(screen.getByText("sales@tucsenberg.com")).toBeInTheDocument();
    expect(screen.queryByText("+86-518-0000-0000")).not.toBeInTheDocument();
    expect(screen.queryByText("TODO-OWNER")).not.toBeInTheDocument();
    expect(screen.queryByText("Phone")).not.toBeInTheDocument();
    expect(screen.queryByText(/WhatsApp/i)).not.toBeInTheDocument();
  });

  it("does not render starter FAQ from MDX frontmatter", async () => {
    const page = await ContactPage({
      params: Promise.resolve({ locale: "en" }),
    });

    await renderAsyncPage(page as React.JSX.Element);

    expect(screen.queryByTestId("faq-section")).not.toBeInTheDocument();
  });

  it("renders the Tucsenberg inquiry handoff before the form", async () => {
    const page = await ContactPage({
      params: Promise.resolve({ locale: "en" }),
    });

    await renderAsyncPage(page as React.JSX.Element);

    const handoff = screen.getByTestId("contact-inquiry-handoff");
    const formColumn = screen.getByTestId("contact-form-column");

    expect(
      within(handoff).getByRole("heading", {
        level: 2,
        name: "Fastest route",
      }),
    ).toBeInTheDocument();
    expect(handoff).toHaveTextContent(
      "The RFQ form asks the questions we would ask anyway",
    );
    expect(handoff).toHaveTextContent("What you are protecting");
    expect(handoff).toHaveTextContent("Dimensions");
    expect(handoff).toHaveTextContent("Market and port");
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
      within(confidenceColumn).getAllByText(/reply|quote|details/i).length,
    ).toBeGreaterThan(0);
    expect(within(confidenceColumn).getByText("12 hours")).toBeInTheDocument();
    expect(
      within(confidenceColumn).getByText("Details are sufficient"),
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

    expect(enMetadata.title).toBe(
      "Contact Tucsenberg — Flood Barrier Supplier, China",
    );
    expect(enMetadata.description).toBe(
      "Contact Tucsenberg — factory-direct flood barriers from China. Reply within 12 hours; pricing follows when project details are sufficient.",
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
        title: "Contact Tucsenberg — Flood Barrier Supplier, China",
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
