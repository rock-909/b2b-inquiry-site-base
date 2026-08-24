/**
 * Lead Pipeline Schema Definitions
 * Canonical inquiry schema for /api/inquiry.
 */

import {
  literal,
  object,
  type output as ZodOutput,
  string,
  type ZodOptional,
  type ZodString,
} from "zod";
import {
  canonicalBuyerEmailSchema,
  canonicalBuyerFullNameSchema,
  canonicalBuyerMessageSchema,
} from "@/lib/lead-pipeline/canonical-buyer-fields";
import { sanitizePlainText } from "@/lib/security/validation";
import type { AttributionFieldName } from "@/lib/marketing/attribution-fields";

export const INQUIRY_LEAD_TYPE = "inquiry" as const;

const sanitizedString = () => string().overwrite(sanitizePlainText);
const MAX_ATTRIBUTION_FIELD_LENGTH = 256;

export const leadAttributionFields = {
  utmSource: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  utmMedium: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  utmCampaign: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  utmTerm: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  utmContent: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  landingPage: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  capturedAt: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
} satisfies Record<AttributionFieldName, ZodOptional<ZodString>>;

const baseLeadFields = {
  ...leadAttributionFields,
};

/**
 * 单独导出对象层，让路由合同测试直接读取真实字段，而不是维护平行清单。
 */
export const inquiryLeadObjectSchema = object({
  type: literal(INQUIRY_LEAD_TYPE),
  fullName: canonicalBuyerFullNameSchema,
  email: canonicalBuyerEmailSchema,
  message: canonicalBuyerMessageSchema.optional(),
  ...baseLeadFields,
});

export const inquiryLeadSchema = inquiryLeadObjectSchema;

export type InquiryLeadInput = ZodOutput<typeof inquiryLeadSchema>;
