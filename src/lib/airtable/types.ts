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

export interface ProductLeadData extends BaseLeadData {
  firstName: string;
  lastName: string;
  message: string;
  productName: string;
  catalogProductId?: string;
  requirements?: string;
}
