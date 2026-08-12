import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_OFFERING } from "@/test/offerings";
import { INQUIRY_LEAD_TYPE, inquiryLeadSchema } from "../lead-schema";
import { processValidatedInquiry } from "../process-lead";

const { mockCreateLead, mockSendProductInquiryEmail } = vi.hoisted(() => ({
  mockCreateLead: vi.fn(),
  mockSendProductInquiryEmail: vi.fn(),
}));

vi.mock("@/lib/airtable/instance", () => ({
  airtableService: { createLead: mockCreateLead },
}));
vi.mock("@/lib/resend-instance", () => ({
  resendService: { sendInquiryEmail: mockSendProductInquiryEmail },
}));
vi.mock("@/lib/logger", async () => import("@/lib/__tests__/mocks/logger"));
vi.mock("@/config/offerings", async () => import("@/test/offerings"));

describe("canonical inquiry contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateLead.mockResolvedValue({ id: "rec-123" });
    mockSendProductInquiryEmail.mockResolvedValue("email-123");
  });

  it("delivers a general inquiry through schema, owner email, and Airtable", async () => {
    const lead = inquiryLeadSchema.parse({
      type: INQUIRY_LEAD_TYPE,
      fullName: "Ada Buyer",
      email: "ada@example.com",
      message: "Please contact me about this project.",
    });

    await processValidatedInquiry(lead);

    expect(mockCreateLead).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ada@example.com",
        message: "Requirements: Please contact me about this project.",
      }),
    );
    expect(mockSendProductInquiryEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ada@example.com",
        requirements: "Please contact me about this project.",
      }),
    );
    expect(mockCreateLead.mock.calls[0]?.[0]).not.toHaveProperty("offeringId");
  });

  it("delivers an offering inquiry with canonical server offering identity", async () => {
    const lead = inquiryLeadSchema.parse({
      type: INQUIRY_LEAD_TYPE,
      fullName: "Ada Buyer",
      email: "ada@example.com",
      message: "Please contact me about this project.",
      interest: "  Custom fabrication  ",
      offeringId: TEST_OFFERING.id,
      offeringName: "Forged browser label",
      offeringLabel: "Forged browser label",
    });

    await processValidatedInquiry(lead);

    expect(mockCreateLead).toHaveBeenCalledWith(
      expect.objectContaining({
        offeringId: TEST_OFFERING.id,
        offeringName: TEST_OFFERING.name,
        message:
          "Offering: Test Offering\nInterest: Custom fabrication\nRequirements: Please contact me about this project.",
      }),
    );
    expect(mockSendProductInquiryEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        offeringId: TEST_OFFERING.id,
        offeringName: TEST_OFFERING.name,
        interest: "Custom fabrication",
        requirements: "Please contact me about this project.",
      }),
    );
  });

  it("rejects unknown offering ids before delivery", () => {
    expect(() =>
      inquiryLeadSchema.parse({
        type: INQUIRY_LEAD_TYPE,
        fullName: "Ada Buyer",
        email: "ada@example.com",
        offeringId: "unknown-product",
      }),
    ).toThrow();
  });

  it("keeps interest as capped free text", async () => {
    const longInterest = `  ${"x".repeat(220)}  `;
    const lead = inquiryLeadSchema.parse({
      type: INQUIRY_LEAD_TYPE,
      fullName: "Ada Buyer",
      email: "ada@example.com",
      interest: longInterest,
    });

    await processValidatedInquiry(lead);

    expect(mockCreateLead).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `Interest: ${"x".repeat(200)}`,
      }),
    );
  });

  it("preserves the either-channel success policy", async () => {
    mockSendProductInquiryEmail.mockRejectedValueOnce(new Error("email down"));
    const lead = inquiryLeadSchema.parse({
      type: INQUIRY_LEAD_TYPE,
      fullName: "Jane Buyer",
      email: "jane@example.com",
    });

    await expect(processValidatedInquiry(lead)).resolves.toMatchObject({
      success: true,
      emailSent: false,
      recordCreated: true,
    });
  });
});
