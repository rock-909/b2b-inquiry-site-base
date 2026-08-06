import { MAX_LEAD_MESSAGE_LENGTH } from "@/constants/validation-limits";
import { PRODUCT_INQUIRY_KINDS } from "@/lib/lead-pipeline/product-inquiry-kinds";
import type { ValidatedInquiryContext } from "@/lib/lead-pipeline/inquiry-handoff";
import {
  pickAttributionFieldsFromFormData,
  type MarketingAttributionFields,
} from "@/lib/marketing/attribution-fields";

interface InquiryPayload extends MarketingAttributionFields {
  readonly fullName: string;
  readonly email: string;
  readonly productInquiryKind:
    | typeof PRODUCT_INQUIRY_KINDS.CATALOG_PRODUCT
    | typeof PRODUCT_INQUIRY_KINDS.GENERAL_RFQ;
  readonly catalogProductId?: string;
  readonly message?: string;
  readonly buyerInterest?: string;
  readonly website: string;
  readonly turnstileToken: string;
}

function getOptionalString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function createInquiryPayload(
  formData: FormData,
  turnstileToken: string,
  context: ValidatedInquiryContext,
): InquiryPayload {
  const fullName = getOptionalString(formData, "fullName");
  const email = getOptionalString(formData, "email");
  const message = getOptionalString(formData, "message");
  const website = getOptionalString(formData, "website");
  const identity =
    context.kind === "catalog-context"
      ? {
          productInquiryKind: PRODUCT_INQUIRY_KINDS.CATALOG_PRODUCT,
          catalogProductId: context.catalogProductId,
        }
      : { productInquiryKind: PRODUCT_INQUIRY_KINDS.GENERAL_RFQ };

  return {
    fullName,
    email,
    ...identity,
    website,
    ...(message ? { message } : {}),
    ...(context.kind === "general-context" && context.buyerInterest
      ? { buyerInterest: context.buyerInterest }
      : {}),
    turnstileToken,
    ...pickAttributionFieldsFromFormData(formData),
  };
}

export function getInquiryMessageMaxLength(): number {
  return MAX_LEAD_MESSAGE_LENGTH;
}
