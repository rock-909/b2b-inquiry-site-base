import { createTranslator } from "next-intl";
import baseEnglishMessages from "@messages/base/en/messages.json";

// 消息会被预编译，带 ICU 语法的文案是数组而不是字符串，只能经 translator 取值。
const t = createTranslator({
  locale: "en",
  messages: baseEnglishMessages,
  namespace: "emailTemplates",
});

export const EMAIL_COPY = {
  common: {
    fields: {
      contactName: t("common.fields.contactName"),
      email: t("common.fields.email"),
      reference: t("common.fields.reference"),
      requirements: t("common.fields.requirements"),
      language: t("common.fields.language"),
      attribution: t("common.fields.attribution"),
    },
  },
  inquiry: {
    title: t("inquiry.title"),
    preview: t("inquiry.preview"),
    footer: t("inquiry.footer"),
    subject: (data: { referenceId: string }) =>
      `[${data.referenceId}] ${t("inquiry.subject")}`,
  },
} as const;
