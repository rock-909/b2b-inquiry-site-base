import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const COPY_BEARING_LOCAL_CONSTANT_PATTERN = /\bconst\s+([A-Z][A-Z0-9_]*)\s*=/g;

const COPY_BEARING_LOCAL_CONSTANT_TOKENS = new Set([
  "COPY",
  "TEXT",
  "TITLE",
  "SUBJECT",
  "PREVIEW",
  "FOOTER",
  "MESSAGE",
  "INTRO",
  "SIGNOFF",
]);

function readJsonFile(path: string): unknown {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- tests read fixed repository files
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function getObjectKeys(value: unknown): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      "Expected object while checking email template message keys",
    );
  }

  return Object.keys(value as Record<string, unknown>).sort();
}

function getNestedKeys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, nestedValue]) =>
      getNestedKeys(nestedValue, prefix ? `${prefix}.${key}` : key),
  );
}

function hasCopyBearingLocalConstant(source: string): boolean {
  for (const match of source.matchAll(COPY_BEARING_LOCAL_CONSTANT_PATTERN)) {
    const constantName = match[1];
    const constantTokens = constantName?.split("_") ?? [];

    if (
      constantTokens.some(
        (token) =>
          token !== "TEXT" && COPY_BEARING_LOCAL_CONSTANT_TOKENS.has(token),
      )
    ) {
      return true;
    }

    if (constantName === "TEXT" || constantName?.endsWith("_TEXT")) {
      return true;
    }
  }

  return false;
}

describe("email copy boundary", () => {
  it("detects copy-bearing local constants, including unsuffixed template copy names", () => {
    const copyBearingExamples = [
      "const TITLE =",
      "const SUBJECT =",
      "const PREVIEW =",
      "const COPY =",
      "const MESSAGE =",
      "const INTRO =",
      "const SIGNOFF =",
      "const FOOTER =",
      "const BODY_COPY =",
      "const FOOTER_TEXT =",
      "const PREVIEW_TITLE =",
    ] as const;

    const nonCopyExamples = [
      "const CARD_STYLE =",
      "const PRIMARY_COLOR =",
      "const BODY_TEXT_STYLE =",
      "const TEXT_COLOR =",
    ] as const;

    for (const copyBearingExample of copyBearingExamples) {
      expect(hasCopyBearingLocalConstant(copyBearingExample)).toBe(true);
    }

    for (const nonCopyExample of nonCopyExamples) {
      expect(hasCopyBearingLocalConstant(nonCopyExample)).toBe(false);
    }
  });

  it("keeps transactional email message-pack keys present in the en-only runtime pack", () => {
    const english = readJsonFile("messages/base/en/messages.json") as {
      emailTemplates?: unknown;
    };

    expect(english.emailTemplates).toBeDefined();
    expect(getObjectKeys(english.emailTemplates)).toEqual([
      "common",
      "productInquiry",
    ]);
    expect(getNestedKeys(english.emailTemplates).sort()).toEqual(
      expect.arrayContaining([
        "productInquiry.footer",
        "productInquiry.preview",
        "productInquiry.subject",
        "common.fields.contactName",
        "common.fields.email",
        "common.fields.product",
        "common.fields.requirements",
      ]),
    );
  });

  it("keeps runtime email copy independent from next-intl and page components", () => {
    const source = readFileSync("src/emails/email-copy.ts", "utf8");

    expect(source).toContain("@messages/base/en/messages.json");
    expect(source).not.toContain("next-intl");
    expect(source).not.toContain("@/components/");
    expect(source).not.toContain("@/app/");
  });
});
