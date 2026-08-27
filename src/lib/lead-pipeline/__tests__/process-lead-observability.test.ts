import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";
import { INQUIRY_LEAD_TYPE, type InquiryLeadInput } from "../lead-schema";
import { processValidatedInquiry } from "../process-lead";

const { mockCreateLead, mockSendProductInquiryEmail } = vi.hoisted(() => ({
  mockCreateLead: vi.fn(),
  mockSendProductInquiryEmail: vi.fn(),
}));

vi.mock("@/lib/airtable/service", () => ({
  createAirtableLead: mockCreateLead,
}));
vi.mock("@/lib/resend-core", () => ({
  ResendService: class {
    public readonly sendInquiryEmail = mockSendProductInquiryEmail;
  },
}));
vi.mock("@/lib/logger", async () => import("@/lib/__tests__/mocks/logger"));

const LEAD: InquiryLeadInput = {
  type: INQUIRY_LEAD_TYPE,
  fullName: "Sensitive Buyer",
  email: "sensitive@example.com",
  message: "Private facility details",
};

describe("processValidatedInquiry observability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateLead.mockResolvedValue({ id: "rec-123" });
    mockSendProductInquiryEmail.mockResolvedValue("email-123");
  });

  it("logs the inquiry type and reference id without raw PII", async () => {
    await processValidatedInquiry(LEAD);

    expect(logger.info).toHaveBeenCalledWith(
      "Processing lead",
      expect.objectContaining({
        type: INQUIRY_LEAD_TYPE,
        email: "[REDACTED_EMAIL]",
        leadDeliveryPolicy: "email-primary-airtable-backup",
        referenceId: expect.stringMatching(/^INQ-/),
      }),
    );
    const logs = JSON.stringify(vi.mocked(logger.info).mock.calls);
    expect(logs).not.toContain("sensitive@example.com");
    expect(logs).not.toContain("Private facility details");
  });

  it("sanitizes delivery failure logs", async () => {
    mockCreateLead.mockRejectedValue(new Error("airtable down"));
    mockSendProductInquiryEmail.mockRejectedValue(new Error("email down"));

    const { referenceId } = await processValidatedInquiry(LEAD);

    const logs = JSON.stringify(vi.mocked(logger.error).mock.calls);
    expect(logs).toContain("[REDACTED_EMAIL]");
    expect(logs).toContain(referenceId);
    expect(logs).not.toContain("sensitive@example.com");
    expect(logs).not.toContain("Private facility details");
  });
});
