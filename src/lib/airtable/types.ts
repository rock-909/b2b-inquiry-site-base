/**
 * Airtable 相关类型定义
 */

import type { MarketingAttributionFields } from "@/lib/marketing/attribution-fields";

/** Minimal createLead return shape used by the delivery pipeline. */
export interface CreatedAirtableRecord {
  id: string;
}

interface BaseLeadData extends MarketingAttributionFields {
  email: string;
  referenceId?: string;
}

export interface InquiryLeadData extends BaseLeadData {
  firstName: string;
  lastName: string;
  message: string;
  requirements?: string;
}
