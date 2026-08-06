import { beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";

import { createLeadRecord } from "@/lib/airtable/service-internal/lead-records";

vi.mock("@/lib/logger", async () => {
  const mockLogger = await import("@/lib/__tests__/mocks/logger");
  return mockLogger;
});

const validProductLeadData = {
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
  message: "Test message",
  productName: "ABS Flood Barriers",
  catalogProductId: "abs-flood-barriers",
};

function createMockBase(create: ReturnType<typeof vi.fn>) {
  return {
    table: vi.fn().mockReturnValue({ create }),
  };
}

describe("createLeadRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([undefined, null, "", "   "])(
    "rejects an Airtable create result with invalid id %j",
    async (id) => {
      const mockCreate = vi.fn().mockResolvedValue([{ id }]);
      const base = createMockBase(mockCreate);

      await expect(
        createLeadRecord({
          base: base as never,
          tableName: "Leads",
          data: validProductLeadData,
        }),
      ).rejects.toThrow("Failed to create lead record");
    },
  );

  it("maps a product inquiry and accepts the Airtable SDK array response", async () => {
    const mockCreate = vi.fn().mockResolvedValue([{ id: " rec-123 " }]);
    const base = createMockBase(mockCreate);
    const data = {
      firstName: "Jane",
      lastName: "Buyer",
      email: "Buyer+RFQ@Example.com",
      message: "Need details",
      productName: "ABS Flood Barriers",
      catalogProductId: "abs-flood-barriers",
      requirements: "Custom packaging",
      referenceId: "PRO-test-123",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: '=IMPORTXML("https://example.test")',
      gclid: "gclid-123",
      landingPage: "/en/contact",
      capturedAt: "2026-08-03T00:00:00.000Z",
    };

    await expect(
      createLeadRecord({
        base: base as never,
        tableName: "Contacts",
        data,
      }),
    ).resolves.toEqual({ id: "rec-123" });

    expect(base.table).toHaveBeenCalledWith("Contacts");
    expect(mockCreate).toHaveBeenCalledWith([
      {
        fields: {
          Email: "buyer+rfq@example.com",
          "Submitted At": expect.any(String),
          Status: "New",
          Source: "Product Inquiry",
          "Reference ID": "PRO-test-123",
          "First Name": "Jane",
          "Last Name": "Buyer",
          Message: "Need details",
          "Product Name": "ABS Flood Barriers",
          "Product Slug": "abs-flood-barriers",
          Requirements: "Custom packaging",
          "UTM Source": "google",
          "UTM Medium": "cpc",
          "UTM Campaign": `'${data.utmCampaign}`,
          GCLID: "gclid-123",
          "Landing Page": "/en/contact",
          "Captured At": "2026-08-03T00:00:00.000Z",
        },
      },
    ]);
  });

  it("neutralizes formulas in product fields without changing ordinary Unicode", async () => {
    const mockCreate = vi.fn().mockResolvedValue([{ id: "rec-formula" }]);
    const base = createMockBase(mockCreate);

    await createLeadRecord({
      base: base as never,
      tableName: "Contacts",
      data: {
        firstName: "=Buyer",
        lastName: "García-López",
        email: "buyer@example.com",
        message: "=message",
        productName: "+Product",
        catalogProductId: "-product-slug",
        requirements: "@requirements",
      },
    });

    expect(mockCreate).toHaveBeenCalledWith([
      {
        fields: expect.objectContaining({
          "First Name": "'=Buyer",
          "Last Name": "García-López",
          Message: "'=message",
          "Product Name": "'+Product",
          "Product Slug": "'-product-slug",
          Requirements: "'@requirements",
        }),
      },
    ]);
  });

  it("logs errorType and statusCode for Airtable SDK-style plain errors", async () => {
    const airtableError = {
      error: "INVALID_VALUE_FOR_COLUMN",
      message: 'Field "Product Name" cannot accept the provided value',
      statusCode: 422,
    };

    const mockCreate = vi.fn().mockRejectedValue(airtableError);
    const base = createMockBase(mockCreate);

    await expect(
      createLeadRecord({
        base: base as never,
        tableName: "Leads",
        data: validProductLeadData,
      }),
    ).rejects.toThrow("Failed to create lead record");

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to create lead record",
      expect.objectContaining({
        errorType: "INVALID_VALUE_FOR_COLUMN",
        statusCode: 422,
      }),
    );

    const logContext = vi.mocked(logger.error).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(logContext).not.toHaveProperty("message");
    expect(JSON.stringify(logContext)).not.toContain("john.doe@example.com");
    expect(logContext.error).not.toBe("Unknown error");
  });

  it("logs Error message for standard Error instances", async () => {
    const mockCreate = vi.fn().mockRejectedValue(new Error("Network timeout"));
    const base = createMockBase(mockCreate);

    await expect(
      createLeadRecord({
        base: base as never,
        tableName: "Leads",
        data: validProductLeadData,
      }),
    ).rejects.toThrow("Failed to create lead record");

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to create lead record",
      expect.objectContaining({
        error: "Network timeout",
      }),
    );
  });

  it("logs Unknown error for unrecognized thrown values", async () => {
    const mockCreate = vi.fn().mockRejectedValue("unexpected string failure");
    const base = createMockBase(mockCreate);

    await expect(
      createLeadRecord({
        base: base as never,
        tableName: "Leads",
        data: validProductLeadData,
      }),
    ).rejects.toThrow("Failed to create lead record");

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to create lead record",
      expect.objectContaining({
        error: "Unknown error",
      }),
    );
  });
});
