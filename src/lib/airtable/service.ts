import "server-only";

import type {
  CreatedAirtableRecord,
  InquiryLeadData,
} from "@/lib/airtable/types";
import { env, getRuntimeEnvString } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createLeadRecord } from "@/lib/airtable/service-internal/lead-records";

export const AIRTABLE_REQUEST_TIMEOUT_MS = 8000;

type AirtableEnvKey =
  "AIRTABLE_API_KEY" | "AIRTABLE_BASE_ID" | "AIRTABLE_TABLE_NAME";

function readAirtableEnv(key: AirtableEnvKey): string | undefined {
  return getRuntimeEnvString(key) ?? env[key];
}

export class AirtableService {
  public isReady(): boolean {
    return Boolean(
      readAirtableEnv("AIRTABLE_API_KEY") &&
      readAirtableEnv("AIRTABLE_BASE_ID"),
    );
  }

  public createLead(data: InquiryLeadData): Promise<CreatedAirtableRecord> {
    const apiKey = readAirtableEnv("AIRTABLE_API_KEY");
    const baseId = readAirtableEnv("AIRTABLE_BASE_ID");

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
      tableName: readAirtableEnv("AIRTABLE_TABLE_NAME") || "Contacts",
      data,
      signal: AbortSignal.timeout(AIRTABLE_REQUEST_TIMEOUT_MS),
    });
  }
}
