import { describe, expect, it } from "vitest";
import { EMAIL_COPY } from "@/emails/email-copy";
import type { ProductInquiryEmailData } from "@/lib/email/email-data-schema";
import { buildProductInquiryEmailContent } from "@/lib/email/runtime-email-content";

describe("runtime email content", () => {
  it("renders product inquiry highlight and body fields without losing buyer details", () => {
    const inquiryData: ProductInquiryEmailData = {
      referenceId: "PRO-abc123-deadbeef",
      firstName: "Pat",
      lastName: "Lee",
      email: "pat@example.com",
      productName: "Enterprise Widget",
      requirements: "Line one\nLine two",
    };

    const content = buildProductInquiryEmailContent(inquiryData);

    expect(content.text).toContain("Reference: PRO-abc123-deadbeef");
    expect(content.html).toContain("PRO-abc123-deadbeef");
    expect(content.html).toContain("Enterprise Widget");
    expect(content.html).toContain("Pat Lee");
    expect(content.html).toContain("pat@example.com");
    expect(content.html).toContain("Line one");
    expect(content.html).toContain("Line two");

    expect(content.text).toContain("Product: Enterprise Widget");
    expect(content.text).toContain("Contact Name: Pat Lee");
    expect(content.text).toContain("Email: pat@example.com");
    expect(content.text).toContain("Requirements: Line one\nLine two");
  });

  it("omits requirements when not provided", () => {
    const inquiryData: ProductInquiryEmailData = {
      referenceId: "PRO-abc123-deadbeef",
      firstName: "Pat",
      lastName: "Lee",
      email: "pat@example.com",
      productName: "Enterprise Widget",
    };

    const content = buildProductInquiryEmailContent(inquiryData);

    expect(content.text).not.toContain("Requirements:");
    expect(content.html).not.toContain(EMAIL_COPY.common.fields.requirements);
  });

  it("escapes special characters in HTML while keeping readable text content", () => {
    const content = buildProductInquiryEmailContent({
      referenceId: "PRO-abc123-deadbeef",
      firstName: "J&ne",
      lastName: "<Buyer>",
      email: "pat@example.com",
      productName: "Widget {quantity}",
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
