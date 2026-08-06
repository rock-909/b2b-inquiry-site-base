import { describe, expect, it } from "vitest";
import { sanitizeAirtableTextField } from "@/lib/airtable/service-internal/field-sanitization";
import { buildInquiryEmailContent } from "@/lib/email/runtime-email-content";
import { INQUIRY_LEAD_TYPE, inquiryLeadSchema } from "../lead-schema";

describe("multiline lead fields", () => {
  it("preserves canonical message newlines through schema and sink sanitizers", () => {
    const parsed = inquiryLeadSchema.parse({
      type: INQUIRY_LEAD_TYPE,
      fullName: "Jane Buyer",
      email: "jane@example.com",
      message: "Need custom height\nStainless finish",
    });

    expect(parsed.message).toBe("Need custom height\nStainless finish");
    expect(sanitizeAirtableTextField(parsed.message!)).toBe(
      "Need custom height\nStainless finish",
    );

    const content = buildInquiryEmailContent({
      referenceId: "PRO-abc123-deadbeef",
      firstName: "Jane",
      lastName: "Buyer",
      email: "jane@example.com",
      requirements: parsed.message,
    });
    expect(content.html).toContain("Need custom height");
    expect(content.html).toContain("Stainless finish");
    expect(content.text).toContain("Need custom height\nStainless finish");
  });

  it("collapses newlines in the single-line full name", () => {
    const parsed = inquiryLeadSchema.parse({
      type: INQUIRY_LEAD_TYPE,
      fullName: "Jane\nBuyer",
      email: "jane@example.com",
    });

    expect(parsed.fullName).toBe("Jane Buyer");
  });
});
