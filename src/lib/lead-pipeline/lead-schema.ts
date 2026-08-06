/**
 * Lead Pipeline Schema Definitions
 * Canonical product/general inquiry schema for /api/inquiry
 */

import { z } from "zod";
import { isProductMarketSlug } from "@/constants/product-catalog";
import {
  canonicalBuyerEmailSchema,
  canonicalBuyerFullNameSchema,
  canonicalBuyerMessageSchema,
} from "@/lib/lead-pipeline/canonical-buyer-fields";
import {
  PRODUCT_INQUIRY_KINDS,
  type ProductInquiryKind,
} from "@/lib/lead-pipeline/product-inquiry-kinds";
import { sanitizePlainText } from "@/lib/security/validation";
import type { AttributionFieldName } from "@/lib/marketing/attribution-fields";
import { MAX_LEAD_PRODUCT_NAME_LENGTH } from "@/constants";

export const PRODUCT_LEAD_TYPE = "product" as const;

export { PRODUCT_INQUIRY_KINDS, type ProductInquiryKind };

const sanitizedString = () => z.string().overwrite(sanitizePlainText);
const MAX_ATTRIBUTION_FIELD_LENGTH = 256;

export const leadAttributionFields = {
  utmSource: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  utmMedium: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  utmCampaign: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  utmTerm: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  utmContent: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  gclid: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  fbclid: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
  msclkid: sanitizedString().max(MAX_ATTRIBUTION_FIELD_LENGTH).optional(),
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

const catalogProductIdSchema = z
  .string()
  .trim()
  .min(1)
  .refine(isProductMarketSlug, {
    error: "catalogProductId must match a real catalog product",
  });

/**
 * 单独导出对象层，是为了让测试能从 `.shape` 读出字段名，而不是再手抄一份清单。
 * `productLeadSchema` 结尾的 `.superRefine` 返回的不是 `ZodObject`，读不到 `.shape`。
 * 手抄的清单会随时间悄悄变短——这个仓库就是被这类清单坑过才有这一轮整改。
 */
export const productLeadObjectSchema = z.object({
  type: z.literal(PRODUCT_LEAD_TYPE),
  productInquiryKind: z.enum([
    PRODUCT_INQUIRY_KINDS.CATALOG_PRODUCT,
    PRODUCT_INQUIRY_KINDS.GENERAL_RFQ,
  ]),
  fullName: canonicalBuyerFullNameSchema,
  email: canonicalBuyerEmailSchema,
  message: canonicalBuyerMessageSchema.optional(),
  catalogProductId: optionalBlankToUndefined(catalogProductIdSchema).optional(),
  buyerInterest: optionalBlankToUndefined(
    sanitizedString().max(MAX_LEAD_PRODUCT_NAME_LENGTH),
  ).optional(),
  ...baseLeadFields,
});

export const productLeadSchema = productLeadObjectSchema.superRefine(
  (data, ctx) => {
    if (data.productInquiryKind === PRODUCT_INQUIRY_KINDS.CATALOG_PRODUCT) {
      if (!data.catalogProductId) {
        ctx.addIssue({
          code: "custom",
          path: ["catalogProductId"],
          message: "catalogProductId is required for a catalog product inquiry",
        });
      }
      return;
    }

    if (data.catalogProductId !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["catalogProductId"],
        message: "general RFQ must not carry a catalog product identity",
      });
    }
  },
);

export type ProductLeadInput = z.infer<typeof productLeadSchema>;

export function isCatalogProductInquiry(lead: ProductLeadInput): boolean {
  return lead.productInquiryKind === PRODUCT_INQUIRY_KINDS.CATALOG_PRODUCT;
}
