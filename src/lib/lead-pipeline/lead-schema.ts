/**
 * Lead Pipeline Schema Definitions
 * Canonical inquiry schema for /api/inquiry.
 */

import { z } from "zod";
import { getOfferingById } from "@/config/offerings";
import {
  canonicalBuyerEmailSchema,
  canonicalBuyerFullNameSchema,
  canonicalBuyerMessageSchema,
} from "@/lib/lead-pipeline/canonical-buyer-fields";
import { sanitizePlainText } from "@/lib/security/validation";
import type { AttributionFieldName } from "@/lib/marketing/attribution-fields";
import { MAX_LEAD_INTEREST_LENGTH } from "@/constants";

export const INQUIRY_LEAD_TYPE = "inquiry" as const;

const sanitizedString = () => z.string().overwrite(sanitizePlainText);
const MAX_ATTRIBUTION_FIELD_LENGTH = 256;

export const leadAttributionFields = {
  utmSource: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  utmMedium: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  utmCampaign: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  utmTerm: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  utmContent: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  landingPage: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  capturedAt: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
} satisfies Record<AttributionFieldName, z.ZodOptional<z.ZodString>>;

const baseLeadFields = {
  ...leadAttributionFields,
};

/**
 * 空串归一：浏览器把没填的字段发成 ""，不是发成缺省。归一属于 schema，不属于
 * 路由——放在路由里就得为每个新字段补一行清洗，漏一行就是一个静默丢字段的 bug。
 * 写法照抄 canonicalBuyerMessageSchema。
 */
function optionalBlankToUndefined<Output>(inner: z.ZodType<Output>) {
  return z
    .unknown()
    .transform((value) =>
      typeof value === "string" && value.trim().length === 0
        ? undefined
        : value,
    )
    .pipe(z.union([z.undefined(), inner]));
}

const offeringIdSchema = z
  .string()
  .trim()
  .min(1)
  .refine((offeringId) => getOfferingById(offeringId) !== undefined, {
    error: "offeringId must match a configured offering",
  });
const interestSchema = sanitizedString().overwrite((value) =>
  value.slice(0, MAX_LEAD_INTEREST_LENGTH),
);

/**
 * 单独导出对象层，让路由合同测试直接读取真实字段，而不是维护平行清单。
 */
export const inquiryLeadObjectSchema = z.object({
  type: z.literal(INQUIRY_LEAD_TYPE),
  fullName: canonicalBuyerFullNameSchema,
  email: canonicalBuyerEmailSchema,
  message: canonicalBuyerMessageSchema.optional(),
  interest: optionalBlankToUndefined(interestSchema).optional(),
  offeringId: optionalBlankToUndefined(offeringIdSchema).optional(),
  ...baseLeadFields,
});

export const inquiryLeadSchema = inquiryLeadObjectSchema;

export type InquiryLeadInput = z.infer<typeof inquiryLeadSchema>;
