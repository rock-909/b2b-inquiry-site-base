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

const VALID_LEAD: InquiryLeadInput = {
  type: INQUIRY_LEAD_TYPE,
  fullName: "Jane Buyer",
  email: "jane@example.com",
  message: "Need custom height\nStainless finish",
};

describe("processValidatedInquiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateLead.mockResolvedValue({ id: "rec-123" });
    mockSendProductInquiryEmail.mockResolvedValue("email-123");
  });

  it("delivers one validated inquiry to owner email and Airtable", async () => {
    const result = await processValidatedInquiry(VALID_LEAD);

    expect(result).toMatchObject({
      success: true,
      emailSent: true,
      recordCreated: true,
    });
    expect(result.referenceId).toMatch(/^INQ-/);
    expect(mockSendProductInquiryEmail).toHaveBeenCalledWith({
      referenceId: result.referenceId,
      firstName: "Jane",
      lastName: "Buyer",
      email: "jane@example.com",
      requirements: "Need custom height\nStainless finish",
    });
    expect(mockCreateLead).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Jane",
        lastName: "Buyer",
        email: "jane@example.com",
        requirements: "Need custom height\nStainless finish",
        message: expect.stringContaining("Requirements: Need custom height"),
        referenceId: expect.stringMatching(/^INQ-/),
      }),
    );
    expect(mockCreateLead.mock.calls[0]?.[0]).not.toHaveProperty("company");
    expect(mockCreateLead.mock.calls[0]?.[0]).not.toHaveProperty("quantity");
  });

  it("gives owner email and Airtable the same reference the buyer receives", async () => {
    const result = await processValidatedInquiry(VALID_LEAD);
    const { referenceId } = result;

    expect(referenceId).toMatch(/^INQ-/);
    expect(mockSendProductInquiryEmail).toHaveBeenCalledWith(
      expect.objectContaining({ referenceId }),
    );
    expect(mockCreateLead).toHaveBeenCalledWith(
      expect.objectContaining({ referenceId }),
    );
  });

  it("keeps that reference in both provider failure logs", async () => {
    mockSendProductInquiryEmail.mockRejectedValue(new Error("email down"));
    mockCreateLead.mockRejectedValue(new Error("airtable down"));

    const { referenceId } = await processValidatedInquiry(VALID_LEAD);

    expect(referenceId).toMatch(/^INQ-/);
    expect(logger.error).toHaveBeenCalledWith(
      "Owner inquiry email failed",
      expect.objectContaining({ referenceId }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      "Inquiry Airtable backup failed",
      expect.objectContaining({ referenceId }),
    );
  });

  it("succeeds when either delivery channel succeeds", async () => {
    mockSendProductInquiryEmail.mockRejectedValueOnce(new Error("email down"));
    await expect(processValidatedInquiry(VALID_LEAD)).resolves.toMatchObject({
      success: true,
      emailSent: false,
      recordCreated: true,
    });

    mockSendProductInquiryEmail.mockResolvedValueOnce("email-456");
    mockCreateLead.mockRejectedValueOnce(new Error("airtable down"));
    await expect(processValidatedInquiry(VALID_LEAD)).resolves.toMatchObject({
      success: true,
      emailSent: true,
      recordCreated: false,
    });
  });

  it("fails only when both delivery channels fail", async () => {
    mockSendProductInquiryEmail.mockRejectedValue(new Error("email down"));
    mockCreateLead.mockRejectedValue(new Error("airtable down"));

    await expect(processValidatedInquiry(VALID_LEAD)).resolves.toMatchObject({
      success: false,
      emailSent: false,
      recordCreated: false,
      referenceId: expect.stringMatching(/^INQ-/),
      error: "PROCESSING_FAILED",
    });
  });

  it("passes attribution fields to the single Airtable record", async () => {
    await processValidatedInquiry({
      ...VALID_LEAD,
      utmSource: "google",
      utmMedium: "cpc",
    });

    expect(mockCreateLead).toHaveBeenCalledWith(
      expect.objectContaining({
        utmSource: "google",
        utmMedium: "cpc",
      }),
    );
  });

  it("starts the backup before email settles and preserves the buyer message", async () => {
    let releaseEmail: (id: string) => void = () => undefined;
    mockSendProductInquiryEmail.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          releaseEmail = resolve;
        }),
    );

    const pending = processValidatedInquiry(VALID_LEAD);
    expect(mockCreateLead).toHaveBeenCalledTimes(1);
    expect(mockCreateLead.mock.calls[0]?.[0].message).toContain(
      VALID_LEAD.message,
    );
    releaseEmail("email-123");
    await expect(pending).resolves.toMatchObject({
      success: true,
      emailSent: true,
      recordCreated: true,
    });
  });
});
