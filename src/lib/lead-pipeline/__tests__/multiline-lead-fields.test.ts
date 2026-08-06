import { describe, expect, it } from "vitest";
import { sanitizeAirtableTextField } from "@/lib/airtable/service-internal/field-sanitization";
import { buildProductInquiryEmailContent } from "@/lib/email/runtime-email-content";
import {
  PRODUCT_INQUIRY_KINDS,
  PRODUCT_LEAD_TYPE,
  productLeadSchema,
} from "../lead-schema";

describe("multiline lead fields", () => {
  it("preserves canonical message newlines through schema and sink sanitizers", () => {
    const parsed = productLeadSchema.parse({
      type: PRODUCT_LEAD_TYPE,
      productInquiryKind: PRODUCT_INQUIRY_KINDS.GENERAL_RFQ,
      fullName: "Jane Buyer",
      email: "jane@example.com",
      message: "Need custom height\nStainless finish",
    });

    expect(parsed.message).toBe("Need custom height\nStainless finish");
    expect(sanitizeAirtableTextField(parsed.message!)).toBe(
      "Need custom height\nStainless finish",
    );

    const content = buildProductInquiryEmailContent({
      referenceId: "PRO-abc123-deadbeef",
      firstName: "Jane",
      lastName: "Buyer",
      email: "jane@example.com",
      productName: "General RFQ",
      requirements: parsed.message,
    });
    expect(content.html).toContain("Need custom height");
    expect(content.html).toContain("Stainless finish");
    expect(content.text).toContain("Need custom height\nStainless finish");
  });

  it("collapses newlines in the single-line full name", () => {
    const parsed = productLeadSchema.parse({
      type: PRODUCT_LEAD_TYPE,
      productInquiryKind: PRODUCT_INQUIRY_KINDS.GENERAL_RFQ,
      fullName: "Jane\nBuyer",
      email: "jane@example.com",
    });

    expect(parsed.fullName).toBe("Jane Buyer");
  });
});
