import { getComposedMessages } from "@/lib/i18n/composed-messages";
import {
  createInquiryFormCopy,
  type InquiryFormCopy,
} from "@/components/forms/inquiry-form-copy";

type JsonObject = Record<string, unknown>;

const enMessages = getComposedMessages("en");

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNestedString(messages: JsonObject, keyPath: string): string {
  const value = keyPath.split(".").reduce<unknown>((current, key) => {
    if (!isJsonObject(current)) return undefined;
    return current[key];
  }, messages);

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing inquiry test message: ${keyPath}`);
  }

  return value;
}

function getInquiryFormMessages(): JsonObject {
  if (!isJsonObject(enMessages.inquiry)) {
    throw new Error("Missing inquiry messages");
  }

  if (!isJsonObject(enMessages.inquiry.form)) {
    throw new Error("Missing inquiry.form messages");
  }

  return enMessages.inquiry.form;
}

export function getInquiryFormMessage(keyPath: string): string {
  return getNestedString(getInquiryFormMessages(), keyPath);
}

export function createTestInquiryFormCopy(): InquiryFormCopy {
  return createInquiryFormCopy(getInquiryFormMessage);
}

export function createTestTurnstileLabels(): InquiryFormCopy["turnstile"] {
  return createTestInquiryFormCopy().turnstile;
}
