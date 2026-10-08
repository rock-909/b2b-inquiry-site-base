import "server-only";

import type { CreatedAirtableRecord } from "@/lib/airtable/types";
import type { ValidatedInquiry } from "@/lib/lead-pipeline/lead-schema";
import { getRuntimeEnvString } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createLeadRecord } from "@/lib/airtable/service-internal/lead-records";

export const AIRTABLE_REQUEST_TIMEOUT_MS = 8000;

export function createAirtableLead(
  data: ValidatedInquiry,
): Promise<CreatedAirtableRecord> {
  const apiKey = getRuntimeEnvString("AIRTABLE_API_KEY");
  const baseId = getRuntimeEnvString("AIRTABLE_BASE_ID");

  if (!apiKey || !baseId) {
    logger.warn("Airtable configuration missing - service will be disabled", {
      hasApiKey: Boolean(apiKey),
      hasBaseId: Boolean(baseId),
    });
    return Promise.reject(new Error("Airtable service is not configured"));
  }

  return createLeadRecord({
    apiKey,
    baseId,
    tableName: getRuntimeEnvString("AIRTABLE_TABLE_NAME") || "Contacts",
    data,
    signal: AbortSignal.timeout(AIRTABLE_REQUEST_TIMEOUT_MS),
  });
}
