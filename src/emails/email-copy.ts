import type { InquiryEmailData } from "@/lib/email/email-data-schema";
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
  inquiry: {
    title: emailTemplateCopy.inquiry.title,
    preview: emailTemplateCopy.inquiry.preview,
    footer: () => emailTemplateCopy.inquiry.footer,
    subject: (data: InquiryEmailData) =>
      `[${data.referenceId}] ${formatTemplate(
        emailTemplateCopy.inquiry.subject,
        {},
      )}`,
  },
} as const;
