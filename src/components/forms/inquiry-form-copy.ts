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
  | "errors.fullName.required"
  | "errors.fullName.invalid"
  | "errors.fullName.tooLong"
  | "errors.email.required"
  | "errors.email.invalid"
  | "errors.email.tooLong"
  | "errors.message.invalid"
  | "errors.message.tooLong"
  | "turnstile.unavailable"
  | "turnstile.loadFailed"
  | "turnstile.slowToLoad"
  | "turnstile.devBypass"
  | "turnstile.testMode"
  | "turnstile.rescueBeforeEmail"
  | "turnstile.rescueAfterEmail"
  | "turnstile.rescueSubject";

type InquiryTranslate = (key: InquiryFormMessageKey) => string;

export function createInquiryFormCopy(t: InquiryTranslate) {
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
      slowToLoad: t("turnstile.slowToLoad"),
      devBypass: t("turnstile.devBypass"),
      testMode: t("turnstile.testMode"),
      rescueBeforeEmail: t("turnstile.rescueBeforeEmail"),
      rescueAfterEmail: t("turnstile.rescueAfterEmail"),
      rescueSubject: t("turnstile.rescueSubject"),
    },
    errors: {
      fieldSummary: t("errors.fieldSummary"),
      securitySummary: t("errors.securitySummary"),
      serverSummary: t("errors.serverSummary"),
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
    },
  } as const;
}

export type InquiryFormCopy = ReturnType<typeof createInquiryFormCopy>;

export function createInquiryFormCopyFromMessages(
  messages: Record<string, unknown>,
): InquiryFormCopy {
  return createInquiryFormCopy((key: InquiryFormMessageKey) =>
    readRequiredMessagePath(messages, ["inquiry", "form", ...key.split(".")]),
  );
}
