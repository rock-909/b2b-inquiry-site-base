import "server-only";

import type {
  CreatedAirtableRecord,
  InquiryLeadData,
} from "@/lib/airtable/types";
import { sanitizeAirtableTextField } from "@/lib/airtable/service-internal/field-sanitization";
import { logger, sanitizeEmail } from "@/lib/logger";
import {
  ATTRIBUTION_FIELD_NAMES,
  type AttributionFieldName,
  type MarketingAttributionFields,
} from "@/lib/marketing/attribution-fields";

type AirtableFieldValue = string | number | boolean;
type AirtableFields = Record<string, AirtableFieldValue>;

const INQUIRY_SOURCE = "Website Inquiry" as const;

const AIRTABLE_ATTRIBUTION_FIELD_NAMES = {
  utmSource: "UTM Source",
  utmMedium: "UTM Medium",
  utmCampaign: "UTM Campaign",
  utmTerm: "UTM Term",
  utmContent: "UTM Content",
  gclid: "GCLID",
  fbclid: "FBCLID",
  msclkid: "MSCLKID",
  landingPage: "Landing Page",
  capturedAt: "Captured At",
} satisfies Record<AttributionFieldName, string>;

function buildBaseFields(email: string, now: string): AirtableFields {
  return {
    Email: email.toLowerCase().trim(),
    "Submitted At": now,
    Status: "New",
    Source: INQUIRY_SOURCE,
  };
}

function addReferenceId(fields: AirtableFields, referenceId?: string): void {
  if (!referenceId) return;
  fields["Reference ID"] = referenceId;
}

function addInquiryFields(fields: AirtableFields, data: InquiryLeadData): void {
  fields["First Name"] = sanitizeAirtableTextField(data.firstName);
  fields["Last Name"] = sanitizeAirtableTextField(data.lastName);
  fields["Message"] = sanitizeAirtableTextField(data.message);
  if (data.interest) {
    fields["Interest"] = sanitizeAirtableTextField(data.interest);
  }
  if (data.offeringId) {
    fields["Offering ID"] = sanitizeAirtableTextField(data.offeringId);
  }
  if (data.offeringName) {
    fields["Offering Name"] = sanitizeAirtableTextField(data.offeringName);
  }
  if (data.requirements) {
    fields["Requirements"] = sanitizeAirtableTextField(data.requirements);
  }
}

function addAttributionFields(
  fields: AirtableFields,
  data: MarketingAttributionFields,
): void {
  for (const fieldName of ATTRIBUTION_FIELD_NAMES) {
    const value = data[fieldName];
    if (value) {
      fields[AIRTABLE_ATTRIBUTION_FIELD_NAMES[fieldName]] =
        sanitizeAirtableTextField(value);
    }
  }
}

function buildLeadFields(data: InquiryLeadData, now: string): AirtableFields {
  const fields = buildBaseFields(data.email, now);
  addReferenceId(fields, data.referenceId);
  addInquiryFields(fields, data);
  addAttributionFields(fields, data);
  return fields;
}

interface AirtableLikeError {
  errorType: string;
  statusCode: number;
}

function isAirtableLikeError(error: unknown): error is AirtableLikeError {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as Record<string, unknown>;
  return (
    typeof candidate.errorType === "string" &&
    typeof candidate.statusCode === "number"
  );
}

function buildCreateLeadRecordLogContext(
  error: unknown,
): Record<string, string | number> {
  if (isAirtableLikeError(error)) {
    return { errorType: error.errorType, statusCode: error.statusCode };
  }

  if (error instanceof Error) {
    return { error: error.message };
  }

  return { error: "Unknown error" };
}

export async function createLeadRecord(params: {
  apiKey: string;
  baseId: string;
  tableName: string;
  data: InquiryLeadData;
  signal: AbortSignal;
}): Promise<CreatedAirtableRecord> {
  const { apiKey, baseId, tableName, data, signal } = params;

  try {
    const now = new Date().toISOString();
    const fields = buildLeadFields(data, now);
    const response = await fetch(
      `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(tableName)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records: [{ fields }] }),
        signal,
      },
    );

    if (!response.ok) {
      throw Object.assign(new Error("Airtable request failed"), {
        errorType: "AIRTABLE_HTTP_ERROR",
        statusCode: response.status,
      });
    }

    const body = (await response.json()) as {
      records?: Array<{ id?: unknown }>;
    };
    const createdRecord = body.records?.[0];
    const recordId =
      typeof createdRecord?.id === "string" ? createdRecord.id.trim() : "";

    if (recordId.length === 0) {
      throw new Error("Airtable success response is missing a record id");
    }

    logger.info("Lead record created successfully", {
      recordId,
      source: INQUIRY_SOURCE,
      email: sanitizeEmail(data.email),
      referenceId: data.referenceId,
    });

    return {
      id: recordId,
    };
  } catch (error) {
    logger.error(
      "Failed to create lead record",
      buildCreateLeadRecordLogContext(error),
    );
    throw new Error("Failed to create lead record", { cause: error });
  }
}
