import { beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";

import { createLeadRecord } from "@/lib/airtable/service-internal/lead-records";
import {
  inquiryLeadSchema,
  type ValidatedInquiry,
} from "@/lib/lead-pipeline/lead-schema";

vi.mock("@/lib/logger", async () => {
  const mockLogger = await import("@/lib/__tests__/mocks/logger");
  return mockLogger;
});

const validInquiryLeadData = {
  ...inquiryLeadSchema.parse({
    type: "inquiry",
    fullName: "John Doe",
    email: "john.doe@example.com",
    message: "Test message",
  }),
  referenceId: "INQ-abc123-deadbeef",
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

function createParams(data: ValidatedInquiry = validInquiryLeadData) {
  return {
    apiKey: "test-api-key",
    baseId: "app/test base",
    tableName: "Lead Records",
    data,
    signal: AbortSignal.timeout(8000),
  };
}

describe("createLeadRecord", () => {
  it("does not log response text when success JSON is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("PRIVATE_BUYER_MESSAGE", { status: 200 }),
        ),
    );
    await expect(createLeadRecord(createParams())).rejects.toThrow(
      "Failed to create lead record",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
      "PRIVATE_BU",
    );
  });

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
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it("posts the mapped inquiry to the Airtable records API", async () => {
    mockAirtableResponse({ records: [{ id: " rec-123 " }] });
    const data = {
      ...inquiryLeadSchema.parse({
        type: "inquiry",
        fullName: "Jane Buyer",
        email: "buyer@example.com",
        message: "Custom packaging",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: '=IMPORTXML("https://example.test")',
        landingPage: "/en/contact",
        capturedAt: "2026-08-03T00:00:00.000Z",
      }),
      referenceId: "INQ-test-123",
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
            Email: "buyer@example.com",
            "Submitted At": expect.any(String),
            Status: "New",
            Source: "Website Inquiry",
            "Reference ID": "INQ-test-123",
            "First Name": "Jane",
            "Last Name": "Buyer",
            Message: "Requirements: Custom packaging",
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

  it.each(["=message", "@requirements"])(
    "neutralizes formula %s without changing ordinary Unicode",
    async (message) => {
      mockAirtableResponse({ records: [{ id: "rec-formula" }] });

      await createLeadRecord(
        createParams({
          ...validInquiryLeadData,
          ...inquiryLeadSchema.parse({
            type: "inquiry",
            fullName: "=Buyer García-López",
            email: "buyer@example.com",
            message,
          }),
        }),
      );

      const request = vi.mocked(fetch).mock.calls[0]?.[1];
      expect(JSON.parse(String(request?.body))).toEqual({
        records: [
          {
            fields: expect.objectContaining({
              "First Name": "'=Buyer",
              "Last Name": "García-López",
              Message: `Requirements: ${message}`,
              Requirements: `'${message}`,
            }),
          },
        ],
      });
    },
  );

  it.each(["=SUM(1)", "+SUM1", "-2+3", "@SUM(1)"])(
    "neutralizes formula prefix in the last name %j",
    async (lastName) => {
      mockAirtableResponse({ records: [{ id: "rec-last-name" }] });

      await createLeadRecord(
        createParams({ ...validInquiryLeadData, fullName: `John ${lastName}` }),
      );

      const request = vi.mocked(fetch).mock.calls[0]?.[1];
      expect(JSON.parse(String(request?.body))).toEqual({
        records: [
          { fields: expect.objectContaining({ "Last Name": `'${lastName}` }) },
        ],
      });
    },
  );

  it("keeps the Message fallback and omits Requirements without a buyer message", async () => {
    mockAirtableResponse({ records: [{ id: "rec-empty" }] });
    const { message: _omitted, ...data } = validInquiryLeadData;
    await createLeadRecord(createParams(data));
    const request = vi.mocked(fetch).mock.calls[0]?.[1];
    const fields = JSON.parse(String(request?.body)).records[0].fields;
    expect(fields.Message).toBe("General inquiry");
    expect(fields).not.toHaveProperty("Requirements");
  });

  it("logs only status metadata for non-success responses", async () => {
    mockAirtableResponse(
      { error: { type: "INVALID_VALUE_FOR_COLUMN", message: "secret body" } },
      422,
    );

    await expect(createLeadRecord(createParams())).rejects.toThrow(
      "Failed to create lead record",
    );

    expect(fetch).toHaveBeenCalledTimes(1);
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

  it("logs the Airtable error type so a missing column is distinguishable", async () => {
    mockAirtableResponse(
      {
        error: {
          type: "UNKNOWN_FIELD_NAME",
          message: 'Unknown field name: "UTM Source"',
        },
      },
      422,
    );

    await expect(createLeadRecord(createParams())).rejects.toThrow(
      "Failed to create lead record",
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith("Failed to create lead record", {
      errorType: "AIRTABLE_HTTP_ERROR",
      statusCode: 422,
      airtableErrorType: "UNKNOWN_FIELD_NAME",
    });
  });

  it("does not log a non-enum Airtable error type", async () => {
    mockAirtableResponse(
      { error: { type: "buyer@example.com wrote this", message: "x" } },
      422,
    );

    await expect(createLeadRecord(createParams())).rejects.toThrow(
      "Failed to create lead record",
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith("Failed to create lead record", {
      errorType: "AIRTABLE_HTTP_ERROR",
      statusCode: 422,
    });
  });

  it("logs Error message for standard Error instances", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network timeout")),
    );

    await expect(createLeadRecord(createParams())).rejects.toThrow(
      "Failed to create lead record",
    );

    expect(fetch).toHaveBeenCalledTimes(1);
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

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to create lead record",
      expect.objectContaining({
        error: "Unknown error",
      }),
    );
  });
});
