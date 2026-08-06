import { getMarketBySlug } from "@/constants/product-catalog";
import {
  PRODUCT_INQUIRY_KINDS,
  type ProductInquiryKind,
  type ProductLeadInput,
} from "@/lib/lead-pipeline/lead-schema";

/**
 * Server-defined display label for a general RFQ (no catalog product identity).
 *
 * This is owner-facing CRM/email text for internal lead notifications, not
 * buyer-visible site copy, so it lives as a server constant rather than an i18n
 * message key.
 */
export const GENERAL_RFQ_PRODUCT_LABEL = "General RFQ (no catalog product)";

export interface ResolvedProductIdentity {
  productInquiryKind: ProductInquiryKind;
  /** Present only for a catalog product inquiry. */
  catalogProductId?: string;
  /** Display name resolved server-side; never taken from the client. */
  productName: string;
}

/**
 * Resolve a validated product lead into its server-defined display identity.
 *
 * For a catalog product the display name comes from the registry entry, not
 * from any client-supplied string; for a general RFQ it is a fixed server
 * label. The client `catalogProductId` is already registry-validated by the
 * lead schema, so `getMarketBySlug` resolves for a well-formed catalog lead.
 */
export function resolveProductIdentity(
  lead: ProductLeadInput,
): ResolvedProductIdentity {
  if (
    lead.productInquiryKind === PRODUCT_INQUIRY_KINDS.CATALOG_PRODUCT &&
    lead.catalogProductId
  ) {
    const market = getMarketBySlug(lead.catalogProductId);
    if (!market) {
      throw new Error(
        "Catalog product identity could not be resolved from the product catalog",
      );
    }

    return {
      productInquiryKind: lead.productInquiryKind,
      catalogProductId: lead.catalogProductId,
      productName: market.label,
    };
  }

  return {
    productInquiryKind: PRODUCT_INQUIRY_KINDS.GENERAL_RFQ,
    productName: GENERAL_RFQ_PRODUCT_LABEL,
  };
}
