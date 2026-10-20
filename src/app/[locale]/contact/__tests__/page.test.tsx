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
  const templateEmail = SINGLE_SITE_CONFIG.contact.email;

  afterEach(() => {
    SINGLE_SITE_CONFIG.contact.email = templateEmail;
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

  // 模板邮箱留空时显示「未配置」文案；派生站填上邮箱后显示 mailto 链接。
  it.each([
    { email: "", expectedHref: null, showsUnavailable: true },
    {
      email: "sales@acme.example",
      expectedHref: "mailto:sales@acme.example",
      showsUnavailable: false,
    },
  ])(
    "renders contact methods when the public email is '$email'",
    async ({ email, expectedHref, showsUnavailable }) => {
      SINGLE_SITE_CONFIG.contact.email = email;
      const { ContactMethodsCard } = await import("../contact-page-sections");

      await renderAsyncPage(<ContactMethodsCard locale="en" />);

      expect(screen.queryByRole("link")?.getAttribute("href") ?? null).toBe(
        expectedHref,
      );
      expect(
        screen.queryByText(enMessages.contact.panel.emailUnavailable) !== null,
      ).toBe(showsUnavailable);
    },
  );

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
