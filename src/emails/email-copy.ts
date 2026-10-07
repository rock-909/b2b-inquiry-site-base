import type { InquiryEmailData } from "@/lib/email/email-data-schema";
import baseEnglishMessages from "@messages/base/en/messages.json";

const emailTemplateCopy = baseEnglishMessages.emailTemplates;

export const EMAIL_COPY = {
  common: {
    fields: emailTemplateCopy.common.fields,
  },
  inquiry: {
    title: emailTemplateCopy.inquiry.title,
    preview: emailTemplateCopy.inquiry.preview,
    footer: () => emailTemplateCopy.inquiry.footer,
    subject: (data: InquiryEmailData) =>
      `[${data.referenceId}] ${emailTemplateCopy.inquiry.subject}`,
  },
} as const;
