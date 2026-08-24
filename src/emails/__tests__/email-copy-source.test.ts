import { describe, expect, it } from "vitest";
import baseEnglishMessages from "@messages/base/en/messages.json";
import { EMAIL_COPY } from "@/emails/email-copy";
import type { InquiryEmailData } from "@/lib/email/email-data-schema";

interface EmailTemplates {
  common: {
    fields: typeof EMAIL_COPY.common.fields;
  };
  inquiry: {
    title: string;
    preview: string;
    footer: string;
    subject: string;
  };
}

const inquiryEmailData: InquiryEmailData = {
  referenceId: "INQ-abc123-deadbeef",
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
  requirements: "Need urgent delivery.",
};

const inquiryEmailDataWithPlaceholderLikeInput: InquiryEmailData = {
  referenceId: "INQ-abc123-deadbeef",
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
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
      "messages/base/en/messages.json must define emailTemplates before EMAIL_COPY can use canonical message authoring.",
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
  it("uses canonical English message copy for common field labels", () => {
    const emailTemplates = getEmailTemplates();

    expect(EMAIL_COPY.common.fields).toEqual(emailTemplates.common.fields);
  });

  it("uses canonical English message copy for inquiry email copy", () => {
    const emailTemplates = getEmailTemplates();

    expect(EMAIL_COPY.inquiry.title).toBe(emailTemplates.inquiry.title);
    expect(EMAIL_COPY.inquiry.preview).toBe(emailTemplates.inquiry.preview);
    expect(EMAIL_COPY.inquiry.footer()).toBe(emailTemplates.inquiry.footer);
    expect(EMAIL_COPY.inquiry.subject(inquiryEmailData)).toBe(
      `[${inquiryEmailData.referenceId}] ${formatTemplate(
        emailTemplates.inquiry.subject,
        {},
      )}`,
    );
  });

  it("resolves every dynamic inquiry template placeholder before rendering", () => {
    expectNoUnresolvedPlaceholders([
      EMAIL_COPY.inquiry.footer(),
      EMAIL_COPY.inquiry.subject(inquiryEmailData),
    ]);
  });

  it("preserves user input that looks like later template placeholders", () => {
    // 用户输入形似模板占位符也不得进入 subject 展开。
    expect(
      EMAIL_COPY.inquiry.subject(inquiryEmailDataWithPlaceholderLikeInput),
    ).toBe("[INQ-abc123-deadbeef] Website inquiry");
  });
});
