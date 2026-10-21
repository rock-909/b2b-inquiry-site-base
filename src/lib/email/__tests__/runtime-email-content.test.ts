import { describe, expect, it } from "vitest";
import { EMAIL_COPY } from "@/emails/email-copy";
import { buildInquiryEmailContent } from "@/lib/email/runtime-email-content";
import {
  inquiryLeadSchema,
  type ValidatedInquiry,
} from "@/lib/lead-pipeline/lead-schema";

describe("runtime email content", () => {
  it("renders inquiry body fields without losing buyer details", () => {
    const inquiryData: ValidatedInquiry = {
      referenceId: "INQ-abc123-deadbeef",
      ...inquiryLeadSchema.parse({
        type: "inquiry",
        fullName: "Pat Lee",
        email: "pat@example.com",
        message: "Line one\nLine two",
      }),
    };

    const content = buildInquiryEmailContent(inquiryData);

    expect(content.text).toContain("Reference: INQ-abc123-deadbeef");
    expect(content.html).toContain("INQ-abc123-deadbeef");
    expect(content.html).toContain("Pat Lee");
    expect(content.html).toContain("pat@example.com");
    expect(content.html).toContain("Line one");
    expect(content.html).toContain("Line two");

    expect(content.text).toContain("Contact Name: Pat Lee");
    expect(content.text).toContain("Email: pat@example.com");
    expect(content.text).toContain("Requirements: Line one\nLine two");
  });

  it("shows a single-word name without a trailing space", () => {
    const content = buildInquiryEmailContent({
      referenceId: "INQ-abc123-deadbeef",
      ...inquiryLeadSchema.parse({
        type: "inquiry",
        fullName: "Madonna",
        email: "pat@example.com",
      }),
    });

    expect(content.text.split("\n")).toContain("Contact Name: Madonna");
  });

  it("omits requirements when not provided", () => {
    const inquiryData: ValidatedInquiry = {
      referenceId: "INQ-abc123-deadbeef",
      ...inquiryLeadSchema.parse({
        type: "inquiry",
        fullName: "Pat Lee",
        email: "pat@example.com",
      }),
    };

    const content = buildInquiryEmailContent(inquiryData);

    expect(content.text).not.toContain("Requirements:");
    expect(content.html).not.toContain(EMAIL_COPY.common.fields.requirements);
  });

  it("escapes special characters in HTML while keeping readable text content", () => {
    const content = buildInquiryEmailContent({
      referenceId: "INQ-abc123-deadbeef",
      ...inquiryLeadSchema.parse({
        type: "inquiry",
        fullName: "J&ne <Buyer>",
        email: "pat@example.com",
        message: "Need <fast> & 'safe' output",
      }),
    });

    expect(content.html).toContain("J&amp;ne &lt;Buyer&gt;");
    expect(content.html).toContain(
      "Need &lt;fast&gt; &amp; &#39;safe&#39; output",
    );
    expect(content.html).not.toContain("Need <fast>");

    expect(content.text).toContain("Contact Name: J&ne <Buyer>");
    expect(content.text).toContain("Requirements: Need <fast> & 'safe' output");
  });

  it("shows the buyer's language and ad attribution to the owner", () => {
    const content = buildInquiryEmailContent({
      referenceId: "INQ-abc123-deadbeef",
      ...inquiryLeadSchema.parse({
        type: "inquiry",
        fullName: "Ana García",
        email: "ana@example.com",
        locale: "es",
        utmCampaign: "promoción & año",
        gclid: "Cj0KCQjw",
        wbraid: "CjkKCQjw",
        gbraid: "0AAAAADd",
        landingPage: "/es",
      }),
    });

    const lines = content.text.split("\n");
    expect(lines).toContain("Language: Español");
    // 多行字段的首行带标签，与 Requirements 的纯文本格式一致。
    expect(lines).toContain("Attribution: utm_campaign: promoción & año");
    expect(lines).toContain("gclid: Cj0KCQjw");
    expect(lines).toContain("wbraid: CjkKCQjw");
    expect(lines).toContain("gbraid: 0AAAAADd");
    expect(lines).toContain("landing_page: /es");
    expect(content.html).toContain("utm_campaign: promoción &amp; año");
  });

  it("omits language and attribution when the inquiry has neither", () => {
    const content = buildInquiryEmailContent({
      referenceId: "INQ-abc123-deadbeef",
      ...inquiryLeadSchema.parse({
        type: "inquiry",
        fullName: "Pat Lee",
        email: "pat@example.com",
      }),
    });

    expect(content.text).not.toContain(`${EMAIL_COPY.common.fields.language}:`);
    expect(content.text).not.toContain(EMAIL_COPY.common.fields.attribution);
  });
});
