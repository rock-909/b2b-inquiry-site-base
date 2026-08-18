import { describe, expect, it } from "vitest";
import { getSourceMessages } from "@/lib/i18n/load-messages";
import { createInquiryFormCopyFromMessages } from "@/components/forms/inquiry-form-copy";
import {
  MAX_LEAD_EMAIL_LENGTH,
  MAX_LEAD_NAME_LENGTH,
} from "@/constants/validation-limits";
import { createTestInquiryFormCopy } from "@/test/inquiry-test-messages";

describe("inquiry form copy", () => {
  it("derives shared labels from inquiry.form", () => {
    const copy = createTestInquiryFormCopy();

    expect(copy.fullName).toBe("Full name");
    expect(copy.email).toBe("Email address");
    expect(copy.message).toBe("Message");
    expect(copy.optional).toBe("optional");
    expect(copy.submit).toBe("Send inquiry");
  });

  it("reads the same namespace from the canonical messages", () => {
    const fromMessages = createInquiryFormCopyFromMessages(
      getSourceMessages("en"),
      "sales@example.invalid",
    );
    const fromHelper = createTestInquiryFormCopy();

    expect(fromMessages.fullName).toBe(fromHelper.fullName);
    expect(fromMessages.errors.fieldSummary).toBe(
      fromHelper.errors.fieldSummary,
    );
  });

  it("reads all eight visible field error leaves from inquiry.form.errors", () => {
    const copy = createTestInquiryFormCopy();

    expect(copy.errors.fullName.required).toBe("Full name is required");
    expect(copy.errors.fullName.invalid).toBe(
      "Full name contains invalid characters",
    );
    expect(copy.errors.fullName.tooLong).toBe(
      `Full name must be ${MAX_LEAD_NAME_LENGTH} characters or fewer`,
    );
    expect(copy.errors.email.required).toBe("Email address is required");
    expect(copy.errors.email.invalid).toBe(
      "Please enter a valid email address",
    );
    expect(copy.errors.email.tooLong).toBe(
      `Email must be ${MAX_LEAD_EMAIL_LENGTH} characters or fewer`,
    );
    expect(copy.errors.message.invalid).toBe(
      "Message contains invalid characters",
    );
    expect(copy.errors.message.tooLong).toBe(
      "Message must be 2000 characters or fewer",
    );
  });

  it("uses fieldSummary for generic validation failures instead of a generic leaf", () => {
    const copy = createTestInquiryFormCopy();
    const messages = getSourceMessages("en") as Record<string, unknown>;

    expect(copy.errors.fieldSummary).toBe(
      "Please review the highlighted fields and try again.",
    );
    expect(
      (messages.inquiry as Record<string, unknown> | undefined)?.form,
    ).toBeDefined();
  });

  it("reads the inquiry Turnstile copy", () => {
    const copy = createTestInquiryFormCopy();

    expect(copy.turnstile.unavailable).toBe(
      "Security verification is temporarily unavailable.",
    );
    expect(copy.turnstile.loadFailed).toBe(
      "Security verification failed to load.",
    );
    expect(copy.turnstile.devBypass).toBe(
      "Dev mode: Turnstile verification bypassed",
    );
    expect(copy.turnstile.testMode).toBe(
      "Bot protection disabled in test mode",
    );
    expect(copy.turnstile.rescueBeforeEmail).toBe("Email us instead —");
    expect(copy.turnstile.rescueAfterEmail).toBe(
      "Include your requirement and contact details.",
    );
    expect(copy.turnstile.rescueSubject).toBe("Quote request");
  });
});
