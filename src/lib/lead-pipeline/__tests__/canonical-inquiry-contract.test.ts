import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PRODUCT_INQUIRY_KINDS,
  PRODUCT_LEAD_TYPE,
  productLeadSchema,
} from "../lead-schema";
import { processValidatedInquiry } from "../process-lead";

const { mockCreateLead, mockSendProductInquiryEmail } = vi.hoisted(() => ({
  mockCreateLead: vi.fn(),
  mockSendProductInquiryEmail: vi.fn(),
}));

vi.mock("@/lib/airtable/instance", () => ({
  airtableService: { createLead: mockCreateLead },
}));
vi.mock("@/lib/resend-instance", () => ({
  resendService: { sendProductInquiryEmail: mockSendProductInquiryEmail },
}));
vi.mock("@/lib/logger", async () => import("@/lib/__tests__/mocks/logger"));

describe("canonical inquiry contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateLead.mockResolvedValue({ id: "rec-123" });
    mockSendProductInquiryEmail.mockResolvedValue("email-123");
  });

  it("uses message as the only buyer requirements source", async () => {
    const lead = productLeadSchema.parse({
      type: PRODUCT_LEAD_TYPE,
      productInquiryKind: PRODUCT_INQUIRY_KINDS.GENERAL_RFQ,
      fullName: "Jane Buyer",
      email: "jane@example.com",
      message: "Line one\nLine two",
      requirements: "retired value",
    });

    await processValidatedInquiry(lead);

    expect(mockCreateLead).toHaveBeenCalledWith(
      expect.objectContaining({ requirements: "Line one\nLine two" }),
    );
    expect(mockSendProductInquiryEmail).toHaveBeenCalledWith(
      expect.objectContaining({ requirements: "Line one\nLine two" }),
    );
  });

  it("keeps buyer interest as description rather than product identity", async () => {
    const lead = productLeadSchema.parse({
      type: PRODUCT_LEAD_TYPE,
      productInquiryKind: PRODUCT_INQUIRY_KINDS.GENERAL_RFQ,
      fullName: "Jane Buyer",
      email: "jane@example.com",
      buyerInterest: "Aluminum flood gates",
    });

    await processValidatedInquiry(lead);

    expect(mockCreateLead).toHaveBeenCalledWith(
      expect.objectContaining({
        productName: "General RFQ (no catalog product)",
        message:
          "Product: General RFQ (no catalog product)\nInterest: Aluminum flood gates",
      }),
    );
    expect(mockCreateLead.mock.calls[0]?.[0]).not.toHaveProperty(
      "catalogProductId",
    );
  });

  it("resolves catalog display identity on the server", async () => {
    const lead = productLeadSchema.parse({
      type: PRODUCT_LEAD_TYPE,
      productInquiryKind: PRODUCT_INQUIRY_KINDS.CATALOG_PRODUCT,
      fullName: "Jane Buyer",
      email: "jane@example.com",
      catalogProductId: "abs-flood-barriers",
    });

    await processValidatedInquiry(lead);

    expect(mockCreateLead).toHaveBeenCalledWith(
      expect.objectContaining({
        productName: "ABS Interlocking Boxwall",
        catalogProductId: "abs-flood-barriers",
      }),
    );
    expect(mockSendProductInquiryEmail).toHaveBeenCalledWith(
      expect.objectContaining({ productName: "ABS Interlocking Boxwall" }),
    );
  });

  it("preserves the either-channel success policy", async () => {
    mockSendProductInquiryEmail.mockRejectedValueOnce(new Error("email down"));
    const lead = productLeadSchema.parse({
      type: PRODUCT_LEAD_TYPE,
      productInquiryKind: PRODUCT_INQUIRY_KINDS.GENERAL_RFQ,
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
