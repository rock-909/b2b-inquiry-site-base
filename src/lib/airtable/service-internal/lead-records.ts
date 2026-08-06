import "server-only";

import type AirtableNS from "airtable";
import type {
  CreatedAirtableRecord,
  ProductLeadData,
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

const PRODUCT_INQUIRY_SOURCE = "Product Inquiry" as const;

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
    Source: PRODUCT_INQUIRY_SOURCE,
  };
}

function addReferenceId(fields: AirtableFields, referenceId?: string): void {
  if (!referenceId) return;
  fields["Reference ID"] = referenceId;
}

function addProductFields(fields: AirtableFields, data: ProductLeadData): void {
  fields["First Name"] = sanitizeAirtableTextField(data.firstName);
  fields["Last Name"] = sanitizeAirtableTextField(data.lastName);
  fields["Message"] = sanitizeAirtableTextField(data.message);
  fields["Product Name"] = sanitizeAirtableTextField(data.productName);
  fields["Product Slug"] = data.catalogProductId
    ? sanitizeAirtableTextField(data.catalogProductId)
    : "";
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

function buildLeadFields(data: ProductLeadData, now: string): AirtableFields {
  const fields = buildBaseFields(data.email, now);
  addReferenceId(fields, data.referenceId);
  addProductFields(fields, data);
  addAttributionFields(fields, data);
  return fields;
}

interface AirtableLikeError {
  error: string;
  message: string;
  statusCode: number;
}

function isAirtableLikeError(error: unknown): error is AirtableLikeError {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as Record<string, unknown>;
  return (
    typeof candidate.error === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.statusCode === "number"
  );
}

function buildCreateLeadRecordLogContext(
  error: unknown,
): Record<string, string | number> {
  if (error instanceof Error) {
    return { error: error.message };
  }

  if (isAirtableLikeError(error)) {
    return { errorType: error.error, statusCode: error.statusCode };
  }

  return { error: "Unknown error" };
}

export async function createLeadRecord(params: {
  base: AirtableNS.Base;
  tableName: string;
  data: ProductLeadData;
}): Promise<CreatedAirtableRecord> {
  const { base, tableName, data } = params;

  try {
    const now = new Date().toISOString();
    const fields = buildLeadFields(data, now);

    const [createdRecord] = await base.table(tableName).create([
      {
        fields,
      },
    ]);

    if (!createdRecord) {
      throw new Error("Failed to create lead record");
    }

    const recordId =
      typeof createdRecord.id === "string" ? createdRecord.id.trim() : "";

    if (recordId.length === 0) {
      throw new Error("Airtable success response is missing a record id");
    }

    logger.info("Lead record created successfully", {
      recordId,
      source: PRODUCT_INQUIRY_SOURCE,
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
