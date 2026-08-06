/**
 * Product-inquiry identity discriminator.
 *
 * A product inquiry is one of two server-defined states, never a client-trusted
 * product slug:
 * - `catalog-product`: a real catalog product, identified by `catalogProductId`
 *   and validated server-side against the product registry.
 * - `general-rfq`: the generic Request-a-Quote flow, which carries no
 *   per-product identity at all.
 *
 * This is a dependency-light leaf module so the client Request-a-Quote form can
 * reference the discriminator without pulling the full server lead schema
 * (zod + product registry) into the browser bundle.
 */
export const PRODUCT_INQUIRY_KINDS = {
  CATALOG_PRODUCT: "catalog-product",
  GENERAL_RFQ: "general-rfq",
} as const;

export type ProductInquiryKind =
  (typeof PRODUCT_INQUIRY_KINDS)[keyof typeof PRODUCT_INQUIRY_KINDS];
