import type { ProductInquiryEmailData } from "@/lib/email/email-data-schema";
import baseEnglishMessages from "@messages/base/en/messages.json";

const emailTemplateCopy = baseEnglishMessages.emailTemplates;
const TEMPLATE_PLACEHOLDER_PATTERN = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

function formatTemplate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(
    TEMPLATE_PLACEHOLDER_PATTERN,
    (placeholder: string, key: string) => {
      const value = values[key];

      return value === undefined ? placeholder : String(value);
    },
  );
}

export const EMAIL_COPY = {
  common: {
    fields: emailTemplateCopy.common.fields,
  },
  productInquiry: {
    title: emailTemplateCopy.productInquiry.title,
    preview: emailTemplateCopy.productInquiry.preview,
    footer: () => emailTemplateCopy.productInquiry.footer,
    subject: (data: ProductInquiryEmailData) =>
      `[${data.referenceId}] ${formatTemplate(
        emailTemplateCopy.productInquiry.subject,
        { productName: data.productName },
      )}`,
  },
} as const;
