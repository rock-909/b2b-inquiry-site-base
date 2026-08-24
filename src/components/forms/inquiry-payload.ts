import { MAX_LEAD_MESSAGE_LENGTH } from "@/constants/validation-limits";
import {
  pickAttributionFieldsFromFormData,
  type MarketingAttributionFields,
} from "@/lib/marketing/attribution-fields";

export interface InquiryPayload extends MarketingAttributionFields {
  readonly fullName: string;
  readonly email: string;
  readonly message?: string;
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
): InquiryPayload {
  const fullName = getOptionalString(formData, "fullName");
  const email = getOptionalString(formData, "email");
  const message = getOptionalString(formData, "message");
  const website = getOptionalString(formData, "website");

  return {
    fullName,
    email,
    website,
    ...(message ? { message } : {}),
    turnstileToken,
    ...pickAttributionFieldsFromFormData(formData),
  };
}

export function getInquiryMessageMaxLength(): number {
  return MAX_LEAD_MESSAGE_LENGTH;
}
