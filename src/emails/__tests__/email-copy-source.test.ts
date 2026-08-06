import { describe, expect, it } from "vitest";
import baseEnglishMessages from "@messages/base/en/messages.json";
import { EMAIL_COPY } from "@/emails/email-copy";
import type { ProductInquiryEmailData } from "@/lib/email/email-data-schema";

interface EmailTemplates {
  common: {
    fields: typeof EMAIL_COPY.common.fields;
  };
  productInquiry: {
    title: string;
    preview: string;
    footer: string;
    subject: string;
  };
}

const productInquiryEmailData: ProductInquiryEmailData = {
  referenceId: "PRO-abc123-deadbeef",
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
  productName: "Hydraulic Pump Station",
  requirements: "Need urgent delivery.",
};

const productInquiryEmailDataWithPlaceholderLikeInput: ProductInquiryEmailData =
  {
    referenceId: "PRO-abc123-deadbeef",
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    productName: "{quantity}",
    requirements: "Need {lastName}",
  };

const UNRESOLVED_PLACEHOLDER_PATTERN = /\{[^}]+\}/;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getEmailTemplates(): EmailTemplates {
  const messagePack = baseEnglishMessages as unknown as {
    emailTemplates?: unknown;
  };

  if (!isObjectRecord(messagePack.emailTemplates)) {
    throw new Error(
      "messages/base/en/messages.json must define emailTemplates before EMAIL_COPY can use message-pack authoring.",
    );
  }

  return messagePack.emailTemplates as unknown as EmailTemplates;
}

function formatTemplate(
  template: string,
  values: Record<string, string | number>,
): string {
  return Object.entries(values).reduce(
    (formatted, [key, value]) =>
      formatted.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function expectNoUnresolvedPlaceholders(value: string | string[]): void {
  const values = Array.isArray(value) ? value : [value];

  for (const renderedValue of values) {
    expect(renderedValue).not.toMatch(UNRESOLVED_PLACEHOLDER_PATTERN);
  }
}

describe("email copy source", () => {
  it("uses default English message-pack copy for common field labels", () => {
    const emailTemplates = getEmailTemplates();

    expect(EMAIL_COPY.common.fields).toEqual(emailTemplates.common.fields);
  });

  it("uses default English message-pack copy for product inquiry email copy", () => {
    const emailTemplates = getEmailTemplates();

    expect(EMAIL_COPY.productInquiry.title).toBe(
      emailTemplates.productInquiry.title,
    );
    expect(EMAIL_COPY.productInquiry.preview).toBe(
      emailTemplates.productInquiry.preview,
    );
    expect(EMAIL_COPY.productInquiry.footer()).toBe(
      emailTemplates.productInquiry.footer,
    );
    expect(EMAIL_COPY.productInquiry.subject(productInquiryEmailData)).toBe(
      `[${productInquiryEmailData.referenceId}] ${formatTemplate(
        emailTemplates.productInquiry.subject,
        { productName: productInquiryEmailData.productName },
      )}`,
    );
  });

  it("resolves every dynamic product inquiry template placeholder before rendering", () => {
    expectNoUnresolvedPlaceholders([
      EMAIL_COPY.productInquiry.footer(),
      EMAIL_COPY.productInquiry.subject(productInquiryEmailData),
    ]);
  });

  it("preserves user input that looks like later template placeholders", () => {
    expect(
      EMAIL_COPY.productInquiry.subject(
        productInquiryEmailDataWithPlaceholderLikeInput,
      ),
    ).toBe("[PRO-abc123-deadbeef] Product Inquiry: {quantity}");
  });
});
