/**
 * Lead Pipeline Schema Definitions
 * Canonical inquiry schema for /api/inquiry. Its output is the one validated
 * inquiry shape handed to owner email and Airtable delivery.
 */

import {
  email,
  literal,
  object,
  type output as ZodOutput,
  string,
  union,
  undefined as zUndefined,
  unknown,
  type ZodOptional,
  type ZodString,
  type ZodType,
} from "zod";
import {
  MAX_LEAD_EMAIL_LENGTH,
  MAX_LEAD_MESSAGE_LENGTH,
  MAX_LEAD_NAME_LENGTH,
} from "@/constants/validation-limits";
import type { AttributionFieldName } from "@/lib/marketing/attribution-fields";
import { hasSpreadsheetFormulaPrefix } from "@/lib/security/spreadsheet-formula";
import {
  sanitizeMultilineText,
  sanitizePlainText,
} from "@/lib/security/validation";

export const INQUIRY_LEAD_TYPE = "inquiry" as const;

const sanitizedString = () => string().overwrite(sanitizePlainText);
const MAX_ATTRIBUTION_FIELD_LENGTH = 256;

const leadAttributionFields = {
  utmSource: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  utmMedium: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  utmCampaign: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  utmTerm: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  utmContent: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  landingPage: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  capturedAt: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
} satisfies Record<AttributionFieldName, ZodOptional<ZodString>>;

function normalizeOptionalInput(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string" && value.trim().length === 0) {
    return undefined;
  }
  return typeof value === "string" ? value.trim() : value;
}

// 在 zod 默认邮箱正则基础上只放宽浏览器 type="email" 接受的两类：
// local part 允许 & 和 #，顶级域允许 xn-- punycode；域名仍至少要有一个点。
const BUYER_EMAIL_PATTERN =
  // eslint-disable-next-line security/detect-unsafe-regex -- 结构与 zod 默认邮箱正则相同：每个域名标签以 . 结尾、无歧义回溯，且输入受请求体大小限制。
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.&#]*)[A-Za-z0-9_+\-&#]@([A-Za-z0-9][A-Za-z0-9-]*\.)+([A-Za-z]{2,}|[xX][nN]--[A-Za-z0-9-]*[A-Za-z0-9])$/;

const buyerMessageSchema: ZodType<string | undefined> = unknown()
  .transform(normalizeOptionalInput)
  .pipe(
    union([
      zUndefined(),
      string().overwrite(sanitizeMultilineText).max(MAX_LEAD_MESSAGE_LENGTH),
    ]),
  );

export const inquiryLeadSchema = object({
  type: literal(INQUIRY_LEAD_TYPE),
  fullName: sanitizedString().min(1).max(MAX_LEAD_NAME_LENGTH),
  // 邮箱小写化只在这里做：owner 邮件的 reply-to 与 Airtable 的 Email 列都读这个值。
  email: email({ pattern: BUYER_EMAIL_PATTERN })
    .overwrite((value) => value.toLowerCase())
    .min(1)
    .max(MAX_LEAD_EMAIL_LENGTH)
    .refine((value) => !hasSpreadsheetFormulaPrefix(value)),
  message: buyerMessageSchema.optional(),
  ...leadAttributionFields,
});

export type InquiryLeadInput = ZodOutput<typeof inquiryLeadSchema>;
