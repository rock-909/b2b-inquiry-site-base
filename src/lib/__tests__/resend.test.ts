import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SINGLE_SITE_CONFIG as SITE_CONFIG } from "@/config/single-site";
import type { ResendService as ResendServiceInstance } from "../resend-core";

type ResendServiceConstructor = new () => ResendServiceInstance;

const { mockRuntimeEnv } = vi.hoisted(() => ({
  mockRuntimeEnv: {
    RESEND_API_KEY: "test-resend-key",
    EMAIL_FROM: "test@example.com",
    EMAIL_REPLY_TO: "reply@example.com",
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

const setupResendTest = async (
  envOverrides: Partial<Record<string, string | undefined>> = {},
): Promise<ResendServiceConstructor> => {
  mockResendSend.mockReset();
  mockResendCtorCalls.mockClear();
  Object.assign(mockRuntimeEnv, {
    RESEND_API_KEY: "test-resend-key",
    EMAIL_FROM: "test@example.com",
    EMAIL_REPLY_TO: "reply@example.com",
    NODE_ENV: "test",
  });
  Object.assign(mockRuntimeEnv, envOverrides);

  const { ResendService } = await import("../resend-core");
  return ResendService;
};

describe("resend - Service Initialization", () => {
  let ResendServiceClass: ResendServiceConstructor;

  beforeEach(async () => {
    ResendServiceClass = await setupResendTest();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("initializes successfully with valid API key", async () => {
    const service = new ResendServiceClass();
    expect(service.isReady()).toBe(true);
    expect(mockResendCtorCalls).toHaveBeenCalledWith("test-resend-key");
    expect(typeof service.sendInquiryEmail).toBe("function");
  });

  it("falls back to the site contact email when email env is absent", async () => {
    ResendServiceClass = await setupResendTest({
      EMAIL_FROM: undefined,
      EMAIL_REPLY_TO: undefined,
    });

    const service = new ResendServiceClass();
    mockResendSend.mockResolvedValue({
      data: { id: "product-inquiry-id" },
      error: null,
    });

    await service.sendInquiryEmail({
      referenceId: "INQ-abc123-deadbeef",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane.smith@example.com",
      offeringId: "sample-offering",
      offeringName: "Sample Offering",
      requirements: "Need bulk pricing",
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
  let ResendServiceClass: ResendServiceConstructor;

  const validInquiryData = {
    referenceId: "INQ-abc123-deadbeef",
    firstName: "Jane",
    lastName: "Smith",
    email: "jane.smith@example.com",
    offeringId: "sample-offering",
    offeringName: "Sample Offering",
    requirements: "Need bulk pricing",
  };

  beforeEach(async () => {
    ResendServiceClass = await setupResendTest();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("sends inquiry email successfully", async () => {
    const service = new ResendServiceClass();

    mockResendSend.mockResolvedValue({
      data: { id: "product-inquiry-id" },
      error: null,
    });

    const result = await service.sendInquiryEmail(validInquiryData);

    const payload = mockResendSend.mock.calls[0]?.[0];

    expect(result).toBe("product-inquiry-id");
    expect(payload).toEqual(
      expect.objectContaining({
        from: "test@example.com",
        to: ["reply@example.com"],
        replyTo: "jane.smith@example.com",
        subject: expect.stringContaining("Sample Offering"),
        html: expect.stringContaining("Sample Offering"),
        text: expect.stringContaining("Sample Offering"),
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

  it("sanitizes inquiry data before rendering without expanding buyer placeholders", async () => {
    const service = new ResendServiceClass();
    const emailData = {
      ...validInquiryData,
      email: "JANE@EXAMPLE.COM",
      offeringName: "<Pump {lastName}>",
      requirements: "Need {lastName}\n\nwith data:text/plain and onclick=alert",
    };

    mockResendSend.mockResolvedValue({
      data: { id: "product-inquiry-id" },
      error: null,
    });

    await service.sendInquiryEmail(emailData);

    const payload = mockResendSend.mock.calls[0]?.[0];

    expect(payload).not.toHaveProperty("react");
    expect(payload.html).toContain("&lt;Pump {lastName}&gt;");
    expect(payload.text).toContain("<Pump {lastName}>");
    expect(payload.text).toContain(
      "Need {lastName}\n\nwith data:text/plain and onclick=alert",
    );
    expect(payload.html).not.toContain("<Pump");
  });

  it("handles API errors for inquiry", async () => {
    const service = new ResendServiceClass();
    mockResendSend.mockResolvedValue({
      data: null,
      error: { message: "Product Inquiry API Error" },
    });

    await expect(service.sendInquiryEmail(validInquiryData)).rejects.toThrow(
      "Failed to send inquiry email",
    );
  });

  it("handles network errors for inquiry", async () => {
    const service = new ResendServiceClass();
    mockResendSend.mockRejectedValue(new Error("Network error"));

    await expect(service.sendInquiryEmail(validInquiryData)).rejects.toThrow(
      "Failed to send inquiry email",
    );
  });

  it("logs the reference on both delivery outcomes so a quoted reference is traceable", async () => {
    const { logger } = await import("@/lib/logger");
    const service = new ResendServiceClass();

    mockResendSend.mockResolvedValue({
      data: { id: "product-inquiry-id" },
      error: null,
    });
    await service.sendInquiryEmail(validInquiryData);

    expect(logger.info).toHaveBeenCalledWith(
      "Inquiry email sent successfully",
      expect.objectContaining({ referenceId: "INQ-abc123-deadbeef" }),
    );

    mockResendSend.mockRejectedValue(new Error("Network error"));
    await expect(service.sendInquiryEmail(validInquiryData)).rejects.toThrow(
      "Failed to send inquiry email",
    );

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to send inquiry email",
      expect.objectContaining({ referenceId: "INQ-abc123-deadbeef" }),
    );
  });
});
