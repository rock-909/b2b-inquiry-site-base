import { describe, expect, it } from "vitest";
import { getSourceMessages } from "@/lib/i18n/load-messages";
import { INQUIRY_VALIDATION_DETAIL_KEYS } from "@/lib/api/inquiry-validation-details";
import { createTestInquiryFormCopy } from "@/test/inquiry-test-messages";

type JsonObject = Record<string, unknown>;

const enMessages = getSourceMessages("en") as JsonObject & {
  inquiry?: JsonObject;
  contact?: JsonObject;
};

const CONTACT_PANEL_KEYS = [
  "contact.panel.contactTitle",
  "contact.panel.emailUnavailable",
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
    const copy = createTestInquiryFormCopy();
    assertNonEmptyStringLeaves(copy, "inquiry.form");
  });

  it("keeps contact fallback copy", () => {
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
});
