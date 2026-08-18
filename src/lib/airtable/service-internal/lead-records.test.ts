import { beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";

import { createLeadRecord } from "@/lib/airtable/service-internal/lead-records";
import type { InquiryLeadData } from "@/lib/airtable/types";

vi.mock("@/lib/logger", async () => {
  const mockLogger = await import("@/lib/__tests__/mocks/logger");
  return mockLogger;
});

const validInquiryLeadData = {
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
  message: "Test message",
  offeringName: "Sample Offering",
  offeringId: "sample-offering",
};

function mockAirtableResponse(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

function createParams(data: InquiryLeadData = validInquiryLeadData) {
  return {
    apiKey: "test-api-key",
    baseId: "app/test base",
    tableName: "Lead Records",
    data,
    signal: AbortSignal.timeout(8000),
  };
}

describe("createLeadRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([undefined, null, "", "   "])(
    "rejects an Airtable response with invalid id %j",
    async (id) => {
      mockAirtableResponse({ records: [{ id }] });

      await expect(createLeadRecord(createParams())).rejects.toThrow(
        "Failed to create lead record",
      );
    },
  );

  it("posts the mapped inquiry to the Airtable records API", async () => {
    mockAirtableResponse({ records: [{ id: " rec-123 " }] });
    const data = {
      firstName: "Jane",
      lastName: "Buyer",
      email: "Buyer+RFQ@Example.com",
      message: "Need details",
      interest: "OEM branding",
      offeringName: "Sample Offering",
      offeringId: "sample-offering",
      requirements: "Custom packaging",
      referenceId: "INQ-test-123",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: '=IMPORTXML("https://example.test")',
      landingPage: "/en/contact",
      capturedAt: "2026-08-03T00:00:00.000Z",
    };

    const params = createParams(data);
    await expect(createLeadRecord(params)).resolves.toEqual({ id: "rec-123" });

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.airtable.com/v0/app%2Ftest%20base/Lead%20Records",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
        signal: params.signal,
      }),
    );
    const request = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toEqual({
      records: [
        {
          fields: {
            Email: "buyer+rfq@example.com",
            "Submitted At": expect.any(String),
            Status: "New",
            Source: "Website Inquiry",
            "Reference ID": "INQ-test-123",
            "First Name": "Jane",
            "Last Name": "Buyer",
            Message: "Need details",
            Interest: "OEM branding",
            "Offering Name": "Sample Offering",
            "Offering ID": "sample-offering",
            Requirements: "Custom packaging",
            "UTM Source": "google",
            "UTM Medium": "cpc",
            "UTM Campaign": `'${data.utmCampaign}`,
            "Landing Page": "/en/contact",
            "Captured At": "2026-08-03T00:00:00.000Z",
          },
        },
      ],
    });
  });

  it("neutralizes formulas in inquiry fields without changing ordinary Unicode", async () => {
    mockAirtableResponse({ records: [{ id: "rec-formula" }] });

    await createLeadRecord(
      createParams({
        firstName: "=Buyer",
        lastName: "García-López",
        email: "buyer@example.com",
        message: "=message",
        interest: "+Interest",
        offeringName: "+Offering",
        offeringId: "-offering-id",
        requirements: "@requirements",
      }),
    );

    const request = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toEqual({
      records: [
        {
          fields: expect.objectContaining({
            "First Name": "'=Buyer",
            "Last Name": "García-López",
            Message: "'=message",
            Interest: "'+Interest",
            "Offering Name": "'+Offering",
            "Offering ID": "'-offering-id",
            Requirements: "'@requirements",
          }),
        },
      ],
    });
  });

  it("logs only status metadata for non-success responses", async () => {
    mockAirtableResponse(
      { error: { type: "INVALID_VALUE_FOR_COLUMN", message: "secret body" } },
      422,
    );

    await expect(createLeadRecord(createParams())).rejects.toThrow(
      "Failed to create lead record",
    );

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to create lead record",
      expect.objectContaining({
        errorType: "AIRTABLE_HTTP_ERROR",
        statusCode: 422,
      }),
    );

    const logContext = vi.mocked(logger.error).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(logContext).not.toHaveProperty("message");
    expect(JSON.stringify(logContext)).not.toContain("john.doe@example.com");
    expect(JSON.stringify(logContext)).not.toContain("secret body");
  });

  it("logs Error message for standard Error instances", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network timeout")),
    );

    await expect(createLeadRecord(createParams())).rejects.toThrow(
      "Failed to create lead record",
    );

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to create lead record",
      expect.objectContaining({
        error: "Network timeout",
      }),
    );
  });

  it("logs Unknown error for unrecognized thrown values", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue("unexpected string failure"),
    );

    await expect(createLeadRecord(createParams())).rejects.toThrow(
      "Failed to create lead record",
    );

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to create lead record",
      expect.objectContaining({
        error: "Unknown error",
      }),
    );
  });
});
