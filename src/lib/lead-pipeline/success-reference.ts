import "server-only";

import type { LeadResult } from "@/lib/lead-pipeline/process-lead";

export function getSuccessfulLeadReferenceId(
  result: LeadResult,
  message = "referenceId missing on successful lead result",
): string {
  if (!result.referenceId) {
    throw new Error(message);
  }

  return result.referenceId;
}
