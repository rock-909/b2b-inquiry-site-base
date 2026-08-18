import enMessagesSource from "../../messages/base/en/messages.json";
import { describe, expect, it } from "vitest";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { createInquiryFormCopyFromMessages } from "@/components/forms/inquiry-form-copy";
import { getSourceMessages } from "@/lib/i18n/load-messages";
import { INQUIRY_VALIDATION_DETAIL_KEYS } from "@/lib/api/inquiry-validation-details";

type JsonObject = Record<string, unknown>;

const enMessages = getSourceMessages("en") as JsonObject & {
  apiErrors: Record<string, unknown>;
  requestQuote?: unknown;
  inquiry?: JsonObject;
  contact?: JsonObject;
};

const REQUEST_QUOTE_PAGE_KEYS = [
  "requestQuote.metadata.title",
  "requestQuote.metadata.description",
  "requestQuote.page.heading",
  "requestQuote.page.intro",
] as const;

const CONTACT_PANEL_KEYS = [
  "contact.panel.contactTitle",
  "contact.panel.email",
  "contact.inquiryHandoff.title",
  "contact.inquiryHandoff.description",
] as const;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getMessageValue(messages: JsonObject, keyPath: string): unknown {
  return keyPath.split(".").reduce<unknown>((current, key) => {
    if (!isJsonObject(current)) return undefined;
    return current[key];
  }, messages);
}

function assertNonEmptyStringLeaves(value: unknown, label: string): void {
  if (typeof value === "string") {
    expect(typeof value, label).toBe("string");
    expect(value.trim(), label).not.toBe("");
    return;
  }

  expect(isJsonObject(value), label).toBe(true);
  for (const [key, nestedValue] of Object.entries(value as JsonObject)) {
    assertNonEmptyStringLeaves(nestedValue, `${label}.${key}`);
  }
}

describe("real i18n runtime message contract", () => {
  it("keeps the inquiry.form leaf set used by InquiryFormCopy", () => {
    const copy = createInquiryFormCopyFromMessages(
      enMessages,
      "sales@example.invalid",
    );
    assertNonEmptyStringLeaves(copy, "inquiry.form");
  });

  it("keeps request quote page and metadata owners", () => {
    for (const keyPath of REQUEST_QUOTE_PAGE_KEYS) {
      const value = getMessageValue(enMessages, keyPath);

      expect(typeof value, keyPath).toBe("string");
      expect(String(value).trim(), keyPath).not.toBe("");
    }
  });

  it("keeps contact panel and inquiry handoff owners", () => {
    for (const keyPath of CONTACT_PANEL_KEYS) {
      const value = getMessageValue(enMessages, keyPath);

      expect(typeof value, keyPath).toBe("string");
      expect(String(value).trim(), keyPath).not.toBe("");
    }
  });

  it("keeps inquiry validation detail keys under inquiry.form", () => {
    const renderableDetails = INQUIRY_VALIDATION_DETAIL_KEYS.filter(
      (detailKey) => detailKey !== "errors.generic",
    );

    for (const detailKey of renderableDetails) {
      const value = getMessageValue(enMessages, `inquiry.form.${detailKey}`);

      expect(typeof value, detailKey).toBe("string");
      expect(String(value).trim(), detailKey).not.toBe("");
    }

    expect(
      getMessageValue(enMessages, "inquiry.form.errors.generic"),
    ).toBeUndefined();
    expect(
      getMessageValue(enMessages, "inquiry.form.errors.fieldSummary"),
    ).toEqual(expect.any(String));
  });

  it("keeps RFQ copy in the canonical locale source", () => {
    expect(enMessagesSource).toHaveProperty("requestQuote");
    expect(enMessages).toHaveProperty("requestQuote");
  });

  it("keeps API error messages aligned with live error codes", () => {
    const liveErrorCodes = Object.values(API_ERROR_CODES).sort();
    const authoringErrorKeys = Object.keys(enMessagesSource.apiErrors).sort();

    expect(authoringErrorKeys).toEqual(liveErrorCodes);
    expect(Object.keys(enMessages.apiErrors).sort()).toEqual(liveErrorCodes);
  });
});
