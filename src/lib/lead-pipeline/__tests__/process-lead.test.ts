import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIRTABLE_REQUEST_TIMEOUT_MS } from "@/lib/airtable/service";
import { logger } from "@/lib/logger";
import {
  PRODUCT_INQUIRY_KINDS,
  PRODUCT_LEAD_TYPE,
  type ProductLeadInput,
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

const VALID_LEAD: ProductLeadInput = {
  type: PRODUCT_LEAD_TYPE,
  productInquiryKind: PRODUCT_INQUIRY_KINDS.CATALOG_PRODUCT,
  fullName: "Jane Buyer",
  email: "jane@example.com",
  message: "Need custom height\nStainless finish",
  catalogProductId: "abs-flood-barriers",
  buyerInterest: "OEM branding",
};

describe("processValidatedInquiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateLead.mockResolvedValue({ id: "rec-123" });
    mockSendProductInquiryEmail.mockResolvedValue("email-123");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delivers one validated inquiry to product email and Airtable", async () => {
    const result = await processValidatedInquiry(VALID_LEAD);

    expect(result).toMatchObject({
      success: true,
      emailSent: true,
      ownerNotified: true,
      recordCreated: true,
    });
    expect(result.referenceId).toMatch(/^PRO-/);
    expect(mockSendProductInquiryEmail).toHaveBeenCalledWith({
      referenceId: result.referenceId,
      firstName: "Jane",
      lastName: "Buyer",
      email: "jane@example.com",
      productName: "ABS Interlocking Boxwall",
      requirements:
        "Interest: OEM branding\nNeed custom height\nStainless finish",
    });
    expect(mockCreateLead).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Jane",
        lastName: "Buyer",
        email: "jane@example.com",
        productName: "ABS Interlocking Boxwall",
        catalogProductId: "abs-flood-barriers",
        requirements: "Need custom height\nStainless finish",
        message: expect.stringContaining("Requirements: Need custom height"),
        referenceId: expect.stringMatching(/^PRO-/),
      }),
    );
    expect(mockCreateLead.mock.calls[0]?.[0]).not.toHaveProperty("company");
    expect(mockCreateLead.mock.calls[0]?.[0]).not.toHaveProperty("quantity");
  });

  it("gives owner email and Airtable the same reference the buyer receives", async () => {
    const result = await processValidatedInquiry(VALID_LEAD);
    const { referenceId } = result;

    expect(referenceId).toMatch(/^PRO-/);
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

    expect(referenceId).toMatch(/^PRO-/);
    expect(logger.error).toHaveBeenCalledWith(
      "Product owner email failed",
      expect.objectContaining({ referenceId }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      "Product Airtable createLead failed (non-blocking)",
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
      ownerNotified: false,
      recordCreated: false,
      referenceId: expect.stringMatching(/^PRO-/),
      error: "PROCESSING_FAILED",
    });
  });

  it("passes attribution fields to the single Airtable record", async () => {
    await processValidatedInquiry({
      ...VALID_LEAD,
      utmSource: "google",
      utmMedium: "cpc",
      gclid: "gclid-123",
    });

    expect(mockCreateLead).toHaveBeenCalledWith(
      expect.objectContaining({
        utmSource: "google",
        utmMedium: "cpc",
        gclid: "gclid-123",
      }),
    );
  });

  it("marks the record when the owner email failed", async () => {
    mockSendProductInquiryEmail.mockRejectedValueOnce(new Error("resend down"));
    mockCreateLead.mockResolvedValueOnce({ id: "rec1" });

    const result = await processValidatedInquiry(VALID_LEAD);

    expect(result.success).toBe(true);
    const fields = mockCreateLead.mock.calls[0]?.[0];
    expect(fields.message).toContain("⚠️ NOTE:");
    expect(fields.message).toContain("FAILED to send");
    // 买家原文必须完整保留，提示只是前缀
    expect(fields.message).toContain(VALID_LEAD.message);
  });

  it("leaves the message untouched when the owner email succeeded", async () => {
    // 真实签名是 Promise<string>，成功必定返回 Resend 的 message id；
    // resolve undefined 是生产里造不出来的状态，别拿它当「成功」。
    mockSendProductInquiryEmail.mockResolvedValueOnce("resend-message-id");
    mockCreateLead.mockResolvedValueOnce({ id: "rec1" });

    await processValidatedInquiry(VALID_LEAD);

    const fields = mockCreateLead.mock.calls[0]?.[0];
    expect(fields.message).not.toContain("⚠️");
  });

  it("waits for the owner email to settle before touching airtable", async () => {
    let releaseEmail: () => void = () => undefined;
    mockSendProductInquiryEmail.mockImplementationOnce(
      () => new Promise<void>((resolve) => (releaseEmail = () => resolve())),
    );
    mockCreateLead.mockResolvedValueOnce({ id: "rec1" });

    const pending = processValidatedInquiry(VALID_LEAD);
    await Promise.resolve();

    // 邮件还没落定，Airtable 一次都不能被碰。并行版本此刻已经调过了。
    expect(mockCreateLead).not.toHaveBeenCalled();

    releaseEmail();
    await pending;
    expect(mockCreateLead).toHaveBeenCalledTimes(1);
  });

  // 这里曾有一条 "still records the lead when the owner email times out"。
  // 它的 mock 自己用 setTimeout 才 reject，resend-http-client.ts 真正的
  // AbortController 一行都没跑到，把阈值改成 60 秒它照样全绿——名字里的
  // "times out" 没有任何东西在守。它实际证的「邮件 reject 后记录仍带提示落地」
  // 由上面 "marks the record when the owner email failed" 覆盖，串行等待由
  // "waits for the owner email to settle before touching airtable" 覆盖，
  // 所以直接删掉，不留一个名不副实的绿灯。

  it("does not hang when Airtable exceeds its request budget", async () => {
    vi.useFakeTimers();
    mockCreateLead.mockReturnValue(new Promise(() => {}));

    const resultPromise = processValidatedInquiry(VALID_LEAD);
    await vi.advanceTimersByTimeAsync(AIRTABLE_REQUEST_TIMEOUT_MS);

    await expect(resultPromise).resolves.toMatchObject({
      success: true,
      emailSent: true,
      recordCreated: false,
    });
  });
});
