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
    subject: (data: { referenceId: string }) =>
      `[${data.referenceId}] ${emailTemplateCopy.inquiry.subject}`,
  },
} as const;
