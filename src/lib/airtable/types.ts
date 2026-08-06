/**
 * Airtable 相关类型定义
 */

import type { MarketingAttributionFields } from "@/lib/marketing/attribution-fields";

/** Minimal createLead return shape from the Airtable SDK write path. */
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
  interest?: string;
  offeringId?: string;
  offeringName?: string;
  requirements?: string;
}
