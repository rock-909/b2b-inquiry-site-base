import { describe, expect, it } from "vitest";
import { EMAIL_COPY } from "@/emails/email-copy";
import type { ValidatedInquiry } from "@/lib/lead-pipeline/lead-schema";

const inquiryEmailData: ValidatedInquiry = {
  type: "inquiry",
  referenceId: "INQ-abc123-deadbeef",
  fullName: "John Doe",
  email: "john.doe@example.com",
  message: "Need urgent delivery.",
};

const UNRESOLVED_PLACEHOLDER_PATTERN = /\{[^}]+\}/;

function expectNoUnresolvedPlaceholders(value: string | string[]): void {
  const values = Array.isArray(value) ? value : [value];

  for (const renderedValue of values) {
    expect(renderedValue).not.toMatch(UNRESOLVED_PLACEHOLDER_PATTERN);
  }
}

describe("email copy source", () => {
  it("resolves every dynamic inquiry template placeholder before rendering", () => {
    expectNoUnresolvedPlaceholders([
      EMAIL_COPY.inquiry.footer,
      EMAIL_COPY.inquiry.subject(inquiryEmailData),
    ]);
  });
});
