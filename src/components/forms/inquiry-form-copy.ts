import {
  type InquiryFieldErrorCopyMap,
  type InquiryFieldErrorDetail,
} from "@/constants/inquiry-field-error-protocol";
import { readRequiredMessagePath } from "@/lib/i18n/read-message-path";

export type InquiryFormSource = "contact" | "request-quote";

type InquiryFormMessageKey =
  | "optional"
  | "fullName"
  | "email"
  | "message"
  | "messageHint"
  | "contextLabel"
  | "submit"
  | "submitting"
  | "success"
  | "referenceLabel"
  | "privacyNotice"
  | "noJsExplanation"
  | "noJsEmailPrefix"
  | "contactAriaLabel"
  | "requestQuoteAriaLabel"
  | "errors.fieldSummary"
  | "errors.securitySummary"
  | "errors.serverSummary"
  | "errors.rateLimitSummary"
  | "errors.rateLimitReady"
  | InquiryFieldErrorDetail
  | "turnstile.unavailable"
  | "turnstile.loadFailed"
  | "turnstile.devBypass"
  | "turnstile.testMode"
  | "turnstile.expired"
  | "turnstile.rescueBeforeEmail"
  | "turnstile.rescueAfterEmail"
  | "turnstile.rescueSubject";

type InquiryTranslate = (key: InquiryFormMessageKey) => string;

export function createInquiryFormCopy(
  t: InquiryTranslate,
  rescueEmail: string,
) {
  // 字段错误文案的完整性由协议模块的 satisfies 合同在编译期封口：协议新增
  // detail 而这里漏写时，type-check 直接红，不再依赖人工同步。
  const fieldErrors = {
    fullName: {
      required: t("errors.fullName.required"),
      invalid: t("errors.fullName.invalid"),
      tooLong: t("errors.fullName.tooLong"),
    },
    email: {
      required: t("errors.email.required"),
      invalid: t("errors.email.invalid"),
      tooLong: t("errors.email.tooLong"),
    },
    message: {
      invalid: t("errors.message.invalid"),
      tooLong: t("errors.message.tooLong"),
    },
  } satisfies InquiryFieldErrorCopyMap;

  return {
    optional: t("optional"),
    fullName: t("fullName"),
    email: t("email"),
    message: t("message"),
    messageHint: t("messageHint"),
    contextLabel: t("contextLabel"),
    submit: t("submit"),
    submitting: t("submitting"),
    success: t("success"),
    referenceLabel: t("referenceLabel"),
    privacyNotice: t("privacyNotice"),
    noJsExplanation: t("noJsExplanation"),
    noJsEmailPrefix: t("noJsEmailPrefix"),
    contactAriaLabel: t("contactAriaLabel"),
    requestQuoteAriaLabel: t("requestQuoteAriaLabel"),
    turnstile: {
      unavailable: t("turnstile.unavailable"),
      loadFailed: t("turnstile.loadFailed"),
      devBypass: t("turnstile.devBypass"),
      testMode: t("turnstile.testMode"),
      expired: t("turnstile.expired"),
      rescueBeforeEmail: t("turnstile.rescueBeforeEmail"),
      rescueAfterEmail: t("turnstile.rescueAfterEmail"),
      rescueEmail,
      rescueSubject: t("turnstile.rescueSubject"),
    },
    errors: {
      fieldSummary: t("errors.fieldSummary"),
      securitySummary: t("errors.securitySummary"),
      serverSummary: t("errors.serverSummary"),
      rateLimitSummary: t("errors.rateLimitSummary"),
      rateLimitReady: t("errors.rateLimitReady"),
      ...fieldErrors,
    },
  } as const;
}

export type InquiryFormCopy = ReturnType<typeof createInquiryFormCopy>;

export function createInquiryFormCopyFromMessages(
  messages: Record<string, unknown>,
  rescueEmail: string,
): InquiryFormCopy {
  return createInquiryFormCopy(
    (key: InquiryFormMessageKey) =>
      readRequiredMessagePath(messages, ["inquiry", "form", ...key.split(".")]),
    rescueEmail,
  );
}
