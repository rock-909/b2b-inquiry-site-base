import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SINGLE_SITE_CONFIG as SITE_CONFIG } from "@/config/single-site";
import { inquiryLeadSchema } from "@/lib/lead-pipeline/lead-schema";
import type { sendInquiryEmail as SendInquiryEmail } from "../resend-core";

type SendInquiryEmailFn = typeof SendInquiryEmail;

const { mockRuntimeEnv } = vi.hoisted(() => ({
  mockRuntimeEnv: {
    RESEND_API_KEY: "test-resend-key",
    EMAIL_FROM: "test@example.com",
    INQUIRY_RECIPIENT_EMAIL: "reply@example.com",
    NODE_ENV: "test",
  } as Record<string, string | undefined>,
}));

const mockResendSend = vi.fn();
const mockResendCtorCalls = vi.fn();

class ResendHttpEmailClientMock {
  public readonly send = mockResendSend;

  constructor(apiKey: string) {
    mockResendCtorCalls(apiKey);
  }
}

vi.mock("@/lib/email/resend-http-client", () => ({
  ResendHttpEmailClient: ResendHttpEmailClientMock,
}));

vi.mock("@/lib/env", () => {
  return {
    env: mockRuntimeEnv,
    runtimeEnv: mockRuntimeEnv,
    getRuntimeEnvString: (key: string) => {
      return mockRuntimeEnv[key] ?? "";
    },
    getRuntimeEnvBoolean: () => false,
    isRuntimeProduction: () => false,
  };
});

vi.mock("@/lib/logger", async () => {
  const mockLogger = await import("./mocks/logger");
  return mockLogger;
});

const validInquiryData = {
  referenceId: "INQ-abc123-deadbeef",
  ...inquiryLeadSchema.parse({
    type: "inquiry",
    fullName: "Jane Smith",
    email: "jane.smith@example.com",
    message: "Need bulk pricing",
  }),
};

const setupResendTest = async (
  envOverrides: Partial<Record<string, string | undefined>> = {},
): Promise<SendInquiryEmailFn> => {
  mockResendSend.mockReset();
  mockResendCtorCalls.mockClear();
  Object.assign(mockRuntimeEnv, {
    RESEND_API_KEY: "test-resend-key",
    EMAIL_FROM: "test@example.com",
    INQUIRY_RECIPIENT_EMAIL: "reply@example.com",
    NODE_ENV: "test",
  });
  Object.assign(mockRuntimeEnv, envOverrides);

  const { sendInquiryEmail } = await import("../resend-core");
  return sendInquiryEmail;
};

describe("resend - configuration", () => {
  let sendInquiryEmail: SendInquiryEmailFn;

  beforeEach(async () => {
    sendInquiryEmail = await setupResendTest();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("creates the provider client with the configured API key", async () => {
    mockResendSend.mockResolvedValue({
      data: { id: "product-inquiry-id" },
      error: null,
    });

    await sendInquiryEmail(validInquiryData);

    expect(mockResendCtorCalls).toHaveBeenCalledWith("test-resend-key");
  });

  it("rejects without calling the provider when the API key is missing", async () => {
    sendInquiryEmail = await setupResendTest({ RESEND_API_KEY: undefined });

    await expect(sendInquiryEmail(validInquiryData)).rejects.toThrow(
      "Resend service is not configured",
    );
    expect(mockResendCtorCalls).not.toHaveBeenCalled();
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("falls back to the site contact email when email env is absent", async () => {
    sendInquiryEmail = await setupResendTest({
      EMAIL_FROM: undefined,
      INQUIRY_RECIPIENT_EMAIL: undefined,
    });

    mockResendSend.mockResolvedValue({
      data: { id: "product-inquiry-id" },
      error: null,
    });

    await sendInquiryEmail({
      referenceId: "INQ-abc123-deadbeef",
      ...inquiryLeadSchema.parse({
        type: "inquiry",
        fullName: "Jane Smith",
        email: "jane.smith@example.com",
        message: "Need bulk pricing",
      }),
    });

    const payload = mockResendSend.mock.calls[0]?.[0];
    expect(payload).toEqual(
      expect.objectContaining({
        from: SITE_CONFIG.contact.email,
        to: [SITE_CONFIG.contact.email],
      }),
    );
  });
});

describe("resend - sendInquiryEmail", () => {
  let sendInquiryEmail: SendInquiryEmailFn;

  beforeEach(async () => {
    sendInquiryEmail = await setupResendTest();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("sends inquiry email successfully", async () => {
    mockResendSend.mockResolvedValue({
      data: { id: "product-inquiry-id" },
      error: null,
    });

    const result = await sendInquiryEmail(validInquiryData);

    const payload = mockResendSend.mock.calls[0]?.[0];

    expect(result).toBe("product-inquiry-id");
    expect(payload).toEqual(
      expect.objectContaining({
        from: "test@example.com",
        to: ["reply@example.com"],
        replyTo: "jane.smith@example.com",
        tags: expect.arrayContaining([{ name: "type", value: "inquiry" }]),
      }),
    );
    expect(payload).not.toHaveProperty("react");

    // One reference the buyer can quote must reach subject, body, and provider metadata.
    expect(payload.subject).toContain("INQ-abc123-deadbeef");
    expect(payload.text).toContain("INQ-abc123-deadbeef");
    expect(payload.html).toContain("INQ-abc123-deadbeef");
    expect(payload.tags).toContainEqual({
      name: "reference-id",
      value: "INQ-abc123-deadbeef",
    });
  });

  it.each([
    "R&D#Team@example.xn--p1ai",
    "R&D#Team@example.XN--P1AI",
    "R&D#Team@example.Xn--p1ai",
    "R&D#Team@example.xN--p1ai",
  ])("carries browser-valid address %s to the provider", async (email) => {
    mockResendSend.mockResolvedValue({
      data: { id: "edge-address-id" },
      error: null,
    });
    const buyerEmail = inquiryLeadSchema.shape.email.parse(email);

    await sendInquiryEmail({ ...validInquiryData, email: buyerEmail });

    expect(mockResendSend.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ replyTo: "r&d#team@example.xn--p1ai" }),
    );
  });

  it("escapes buyer text when rendering without expanding buyer placeholders", async () => {
    const emailData = {
      ...validInquiryData,
      ...inquiryLeadSchema.parse({
        ...validInquiryData,
        email: "JANE@EXAMPLE.COM",
        fullName: "Jane <Pump {lastName}>",
        message: "Need {lastName}\n\nwith data:text/plain and onclick=alert",
      }),
    };

    mockResendSend.mockResolvedValue({
      data: { id: "product-inquiry-id" },
      error: null,
    });

    await sendInquiryEmail(emailData);

    const payload = mockResendSend.mock.calls[0]?.[0];

    expect(payload).not.toHaveProperty("react");
    expect(payload.html).toContain("Jane &lt;Pump {lastName}&gt;");
    expect(payload.text).toContain("Jane <Pump {lastName}>");
    expect(payload.text).toContain(
      "Need {lastName}\n\nwith data:text/plain and onclick=alert",
    );
    expect(payload.html).not.toContain("<Pump");
  });

  it("handles API errors for inquiry", async () => {
    mockResendSend.mockResolvedValue({
      data: null,
      error: { message: "Product Inquiry API Error" },
    });

    await expect(sendInquiryEmail(validInquiryData)).rejects.toThrow(
      "Failed to send inquiry email",
    );
    expect(mockResendSend).toHaveBeenCalledTimes(1);
  });

  it("handles network errors for inquiry", async () => {
    mockResendSend.mockRejectedValue(new Error("Network error"));

    await expect(sendInquiryEmail(validInquiryData)).rejects.toThrow(
      "Failed to send inquiry email",
    );
    expect(mockResendSend).toHaveBeenCalledTimes(1);
  });

  it("logs the reference on both delivery outcomes so a quoted reference is traceable", async () => {
    const { logger } = await import("@/lib/logger");

    mockResendSend.mockResolvedValue({
      data: { id: "product-inquiry-id" },
      error: null,
    });
    await sendInquiryEmail(validInquiryData);

    expect(logger.info).toHaveBeenCalledWith(
      "Inquiry email sent successfully",
      expect.objectContaining({ referenceId: "INQ-abc123-deadbeef" }),
    );

    mockResendSend.mockRejectedValue(new Error("Network error"));
    await expect(sendInquiryEmail(validInquiryData)).rejects.toThrow(
      "Failed to send inquiry email",
    );

    expect(mockResendSend).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to send inquiry email",
      expect.objectContaining({ referenceId: "INQ-abc123-deadbeef" }),
    );
  });
});
