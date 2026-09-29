/**
 * Canonical public inquiry buyer fields for /api/inquiry and downstream
 * owner email and Airtable delivery.
 */

import {
  email,
  string,
  union,
  undefined as zUndefined,
  unknown,
  type ZodType,
} from "zod";
import {
  MAX_LEAD_EMAIL_LENGTH,
  MAX_LEAD_MESSAGE_LENGTH,
  MAX_LEAD_NAME_LENGTH,
} from "@/constants/validation-limits";
import { hasSpreadsheetFormulaPrefix } from "@/lib/security/spreadsheet-formula";
import {
  sanitizeMultilineText,
  sanitizePlainText,
} from "@/lib/security/validation";

const sanitizedString = () => string().overwrite(sanitizePlainText);

function normalizeOptionalInput(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string" && value.trim().length === 0) {
    return undefined;
  }
  return typeof value === "string" ? value.trim() : value;
}

export const canonicalBuyerFullNameSchema = sanitizedString()
  .min(1)
  .max(MAX_LEAD_NAME_LENGTH);

// 在 zod 默认邮箱正则基础上只放宽浏览器 type="email" 接受的两类：
// local part 允许 & 和 #，顶级域允许 xn-- punycode；域名仍至少要有一个点。
const BUYER_EMAIL_PATTERN =
  // eslint-disable-next-line security/detect-unsafe-regex -- 结构与 zod 默认邮箱正则相同：每个域名标签以 . 结尾、无歧义回溯，且输入受请求体大小限制。
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.&#]*)[A-Za-z0-9_+\-&#]@([A-Za-z0-9][A-Za-z0-9-]*\.)+([A-Za-z]{2,}|[xX][nN]--[A-Za-z0-9-]*[A-Za-z0-9])$/;

/**
 * 买家邮箱的唯一定义：询盘入口和下游 owner 邮件共用，保证同一地址能贯穿到发件边界。
 */
export const canonicalBuyerEmailSchema = email({ pattern: BUYER_EMAIL_PATTERN })
  .min(1)
  .max(MAX_LEAD_EMAIL_LENGTH)
  .refine((email) => !hasSpreadsheetFormulaPrefix(email));

export const canonicalBuyerMessageSchema: ZodType<string | undefined> =
  unknown()
    .transform(normalizeOptionalInput)
    .pipe(
      union([
        zUndefined(),
        string().overwrite(sanitizeMultilineText).max(MAX_LEAD_MESSAGE_LENGTH),
      ]),
    );
