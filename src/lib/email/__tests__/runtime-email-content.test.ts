import { describe, expect, it } from "vitest";
import { EMAIL_COPY } from "@/emails/email-copy";
import type { InquiryEmailData } from "@/lib/email/email-data-schema";
import { buildInquiryEmailContent } from "@/lib/email/runtime-email-content";

describe("runtime email content", () => {
  it("renders inquiry body fields without losing buyer details", () => {
    const inquiryData: InquiryEmailData = {
      referenceId: "INQ-abc123-deadbeef",
      firstName: "Pat",
      lastName: "Lee",
      email: "pat@example.com",
      offeringId: "sample-offering",
      offeringName: "Sample Offering",
      interest: "OEM branding",
      requirements: "Line one\nLine two",
    };

    const content = buildInquiryEmailContent(inquiryData);

    expect(content.text).toContain("Reference: INQ-abc123-deadbeef");
    expect(content.html).toContain("INQ-abc123-deadbeef");
    expect(content.html).toContain("Sample Offering");
    expect(content.html).toContain("Pat Lee");
    expect(content.html).toContain("pat@example.com");
    expect(content.html).toContain("OEM branding");
    expect(content.html).toContain("Line one");
    expect(content.html).toContain("Line two");

    expect(content.text).toContain("Offering: Sample Offering");
    expect(content.text).toContain("Offering ID: sample-offering");
    expect(content.text).toContain("Interest: OEM branding");
    expect(content.text).toContain("Contact Name: Pat Lee");
    expect(content.text).toContain("Email: pat@example.com");
    expect(content.text).toContain("Requirements: Line one\nLine two");
  });

  it("omits requirements when not provided", () => {
    const inquiryData: InquiryEmailData = {
      referenceId: "INQ-abc123-deadbeef",
      firstName: "Pat",
      lastName: "Lee",
      email: "pat@example.com",
    };

    const content = buildInquiryEmailContent(inquiryData);

    expect(content.text).not.toContain("Requirements:");
    expect(content.html).not.toContain(EMAIL_COPY.common.fields.requirements);
  });

  it("escapes special characters in HTML while keeping readable text content", () => {
    const content = buildInquiryEmailContent({
      referenceId: "INQ-abc123-deadbeef",
      firstName: "J&ne",
      lastName: "<Buyer>",
      email: "pat@example.com",
      offeringName: "Widget {quantity}",
      requirements: "Need <fast> & 'safe' output",
    });

    expect(content.html).toContain("J&amp;ne &lt;Buyer&gt;");
    expect(content.html).toContain("Widget {quantity}");
    expect(content.html).toContain(
      "Need &lt;fast&gt; &amp; &#39;safe&#39; output",
    );
    expect(content.html).not.toContain("Need <fast>");

    expect(content.text).toContain("Contact Name: J&ne <Buyer>");
    expect(content.text).toContain("Requirements: Need <fast> & 'safe' output");
  });
});
