import React from "react";
import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import enMessages from "@messages/base/en/messages.json";
import ContactPage, { generateMetadata } from "@/app/[locale]/contact/page";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";
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
  const templateContact = { ...SINGLE_SITE_CONFIG.contact };
  const templateCompany = SINGLE_SITE_CONFIG.company;

  afterEach(() => {
    SINGLE_SITE_CONFIG.contact = { ...templateContact };
    if (templateCompany) {
      SINGLE_SITE_CONFIG.company = templateCompany;
    } else {
      delete SINGLE_SITE_CONFIG.company;
    }
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

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      contactContent.metadata.title,
    );
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
    expect(screen.getByTestId("inquiry-form")).toBeInTheDocument();
  });

  // 留空即不展示：联系方式全空时整块不渲染；派生站填上邮箱后显示 mailto 链接。
  it.each([
    { email: "", expectedHref: null, showsSection: false },
    {
      email: "sales@acme.example",
      expectedHref: "mailto:sales@acme.example",
      showsSection: true,
    },
  ])(
    "renders contact methods when the public email is '$email'",
    async ({ email, expectedHref, showsSection }) => {
      SINGLE_SITE_CONFIG.contact.email = email;
      const { ContactMethodsCard } = await import("../contact-page-sections");

      await renderAsyncPage(<ContactMethodsCard locale="en" />);

      expect(screen.queryByRole("link")?.getAttribute("href") ?? null).toBe(
        expectedHref,
      );
      expect(
        screen.queryByRole("heading", {
          name: enMessages.contact.panel.contactTitle,
        }) !== null,
      ).toBe(showsSection);
    },
  );

  it("adds the configured WhatsApp link and company address", async () => {
    SINGLE_SITE_CONFIG.contact = {
      email: "sales@acme.com",
      whatsapp: "+34 600 123 456",
    };
    SINGLE_SITE_CONFIG.company = {
      name: "Acme",
      location: { address: "Calle Mayor 1", city: "Valencia" },
    };
    const { ContactMethodsCard } = await import("../contact-page-sections");

    await renderAsyncPage(<ContactMethodsCard locale="en" />);

    expect(
      screen.getByRole("link", { name: /WhatsApp/u }).getAttribute("href"),
    ).toBe("https://wa.me/34600123456");
    expect(screen.getByText("Calle Mayor 1, Valencia")).toBeInTheDocument();
  });

  it("generates runtime SEO metadata for the actual localized contact route", async () => {
    vi.stubEnv("APP_ENV", "production");

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en" }),
    });

    expect(metadata.title).toBe(contactContent.metadata.seo.title);
    expect(metadata.description).toBe(contactContent.metadata.seo.description);
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
