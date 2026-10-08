import { type InquiryFieldErrorDetail } from "@/constants/inquiry-field-error-protocol";

type InquiryFormMessageKey =
  | "optional"
  | "fullName"
  | "email"
  | "message"
  | "messageHint"
  | "submit"
  | "submitting"
  | "success"
  | "referenceLabel"
  | "privacyNotice"
  | "noJsExplanation"
  | "noJsEmailPrefix"
  | "contactAriaLabel"
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
  // 以 wire detail 为键：协议新增 detail 而这里漏写时，type-check 直接红。
  const fieldErrors = {
    "errors.fullName.required": t("errors.fullName.required"),
    "errors.fullName.invalid": t("errors.fullName.invalid"),
    "errors.fullName.tooLong": t("errors.fullName.tooLong"),
    "errors.email.required": t("errors.email.required"),
    "errors.email.invalid": t("errors.email.invalid"),
    "errors.email.tooLong": t("errors.email.tooLong"),
    "errors.message.invalid": t("errors.message.invalid"),
    "errors.message.tooLong": t("errors.message.tooLong"),
  } satisfies Record<InquiryFieldErrorDetail, string>;

  return {
    optional: t("optional"),
    fullName: t("fullName"),
    email: t("email"),
    message: t("message"),
    messageHint: t("messageHint"),
    submit: t("submit"),
    submitting: t("submitting"),
    success: t("success"),
    referenceLabel: t("referenceLabel"),
    privacyNotice: t("privacyNotice"),
    noJsExplanation: t("noJsExplanation"),
    noJsEmailPrefix: t("noJsEmailPrefix"),
    contactAriaLabel: t("contactAriaLabel"),
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
      fields: fieldErrors,
    },
  } as const;
}

export type InquiryFormCopy = ReturnType<typeof createInquiryFormCopy>;
