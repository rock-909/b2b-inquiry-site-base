import { describe, expect, it } from "vitest";
import { MAX_LEAD_MESSAGE_LENGTH } from "@/constants/validation-limits";
import { getSourceMessages } from "@/lib/i18n/load-messages";
import {
  INQUIRY_VALIDATION_DETAIL_KEYS,
  mapInquiryValidationDetails,
} from "@/lib/api/inquiry-validation-details";
import {
  INQUIRY_FIELD_ERROR_DETAILS,
  INQUIRY_FIELD_ERROR_KEYS,
  INQUIRY_FIELD_WIRE_DETAIL_LEAVES,
} from "@/constants/inquiry-field-error-protocol";
import {
  INQUIRY_LEAD_TYPE,
  inquiryLeadSchema,
} from "@/lib/lead-pipeline/lead-schema";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getMessageValue(messages: JsonObject, keyPath: string): unknown {
  return keyPath.split(".").reduce<unknown>((current, key) => {
    if (!isJsonObject(current)) return undefined;
    return current[key];
  }, messages);
}

const runtimeMessages = getSourceMessages("en");

const validBase = {
  type: INQUIRY_LEAD_TYPE,
  fullName: "Ada Lovelace",
  email: "ada@example.com",
} as const;

const inquiryFailureInputs: ReadonlyArray<Record<string, unknown>> = [
  { ...validBase, fullName: undefined },
  { ...validBase, fullName: "" },
  { ...validBase, fullName: 42 },
  { ...validBase, fullName: "A".repeat(300) },
  { ...validBase, email: undefined },
  { ...validBase, email: "" },
  { ...validBase, email: 42 },
  { ...validBase, email: "not-an-email" },
  { ...validBase, email: `a@${"x".repeat(300)}.com` },
  { ...validBase, message: 123 },
  { ...validBase, message: "A".repeat(5000) },
  { ...validBase, utmSource: "x".repeat(257) },
  { ...validBase, utmSource: 42 },
];

describe("inquiry field error lookup table", () => {
  it("covers every declared wire detail exactly, mapping to the matching leaf", () => {
    for (const detail of INQUIRY_FIELD_ERROR_DETAILS) {
      const [, field, leaf] = detail.split(".");
      expect(
        INQUIRY_FIELD_WIRE_DETAIL_LEAVES[
          field as keyof typeof INQUIRY_FIELD_WIRE_DETAIL_LEAVES
        ][detail],
        detail,
      ).toBe(leaf);
    }
  });
});

describe("exact wire contract for inquiry field errors", () => {
  it("maps the real-schema failure matrix to exact, ordered detail arrays", () => {
    const cases: ReadonlyArray<{
      input: Record<string, unknown>;
      expected: string[];
    }> = [
      {
        input: { ...validBase, fullName: undefined },
        expected: ["errors.fullName.required"],
      },
      {
        input: { ...validBase, fullName: "" },
        expected: ["errors.fullName.required"],
      },
      {
        input: { ...validBase, fullName: 42 },
        expected: ["errors.fullName.invalid"],
      },
      {
        input: { ...validBase, fullName: "A".repeat(300) },
        expected: ["errors.fullName.tooLong"],
      },
      {
        input: { ...validBase, email: undefined },
        expected: ["errors.email.required"],
      },
      {
        input: { ...validBase, email: "" },
        expected: ["errors.email.required"],
      },
      {
        input: { ...validBase, email: 42 },
        expected: ["errors.email.invalid"],
      },
      {
        input: { ...validBase, email: "not-an-email" },
        expected: ["errors.email.invalid"],
      },
      {
        input: { ...validBase, email: `a@${"x".repeat(300)}.com` },
        expected: ["errors.email.tooLong"],
      },
      {
        input: { ...validBase, email: "=cmd(a1)@example.com" },
        expected: ["errors.email.invalid"],
      },
      {
        input: { ...validBase, message: 123 },
        expected: ["errors.message.invalid"],
      },
      {
        input: { ...validBase, message: "A".repeat(5000) },
        expected: ["errors.message.tooLong"],
      },
    ];

    for (const { input, expected } of cases) {
      const parsed = inquiryLeadSchema.safeParse(input);
      expect(parsed.success, JSON.stringify(input)).toBe(false);
      if (parsed.success) continue;
      expect(
        mapInquiryValidationDetails(parsed.error.issues, input),
        JSON.stringify(input),
      ).toEqual(expected);
    }
  });

  it("keeps issue order and de-duplicates repeated details", () => {
    // schema 字段顺序：type → fullName → email → message → attribution。
    const parsed = inquiryLeadSchema.safeParse({
      ...validBase,
      fullName: "",
      email: "",
      utmSource: 42,
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(
      mapInquiryValidationDetails(parsed.error.issues, {
        ...validBase,
        fullName: "",
        email: "",
        utmSource: 42,
      }),
    ).toEqual([
      "errors.fullName.required",
      "errors.email.required",
      "errors.generic",
    ]);
  });

  it("suppresses .invalid when .required exists on the same field and keeps the remaining order", () => {
    const issues = [
      {
        code: "custom",
        path: ["email"],
        message: "synthetic",
        params: { reason: "required" },
      },
      {
        code: "invalid_string",
        path: ["email"],
        message: "synthetic invalid",
        validation: "regex",
      },
      {
        code: "too_big",
        path: ["fullName"],
        maximum: 10,
        type: "string",
        inclusive: true,
        message: "synthetic tooLong",
      },
    ] as unknown as Parameters<typeof mapInquiryValidationDetails>[0];

    expect(mapInquiryValidationDetails(issues, validBase)).toEqual([
      "errors.email.required",
      "errors.fullName.tooLong",
    ]);
  });

  it("collapses repeated unknown-field issues into a single errors.generic entry", () => {
    const issues = [
      {
        code: "too_big",
        path: ["utmSource"],
        maximum: 255,
        type: "string",
        inclusive: true,
        message: "synthetic",
      },
      {
        code: "invalid_type",
        path: ["utmSource"],
        expected: "string",
        message: "synthetic",
      },
    ] as unknown as Parameters<typeof mapInquiryValidationDetails>[0];

    expect(mapInquiryValidationDetails(issues)).toEqual(["errors.generic"]);
  });
});

describe("inquiry validation detail mapping", () => {
  it("accepts message when raw length exceeds max but normalization shrinks below max", () => {
    const rawMessage = `Hello${" ".repeat(MAX_LEAD_MESSAGE_LENGTH)}world`;

    expect(rawMessage.length).toBeGreaterThan(MAX_LEAD_MESSAGE_LENGTH);

    const parsed = inquiryLeadSchema.safeParse({
      ...validBase,
      message: rawMessage,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.message).toBe("Hello world");
      expect(parsed.data.message!.length).toBeLessThanOrEqual(
        MAX_LEAD_MESSAGE_LENGTH,
      );
    }
  });

  it("maps canonical message too_long to errors.message.tooLong after normalization", () => {
    const tooLong = inquiryLeadSchema.safeParse({
      ...validBase,
      message: "A".repeat(MAX_LEAD_MESSAGE_LENGTH + 1),
    });
    const wrongType = inquiryLeadSchema.safeParse({
      ...validBase,
      message: 123,
    });

    expect(tooLong.success).toBe(false);
    expect(wrongType.success).toBe(false);
    if (tooLong.success || wrongType.success) return;

    expect(
      mapInquiryValidationDetails(tooLong.error.issues, {
        ...validBase,
        message: "A".repeat(MAX_LEAD_MESSAGE_LENGTH + 1),
      }),
    ).toEqual(["errors.message.tooLong"]);
    expect(
      mapInquiryValidationDetails(wrongType.error.issues, {
        ...validBase,
        message: 123,
      }),
    ).toEqual(["errors.message.invalid"]);
  });

  it("maps internal field issues to errors.generic instead of field-specific keys", () => {
    const input = {
      ...validBase,
      utmSource: 123,
      message: 999,
    };
    const parsed = inquiryLeadSchema.safeParse(input);

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(mapInquiryValidationDetails(parsed.error.issues, input)).toEqual(
      expect.arrayContaining(["errors.generic", "errors.message.invalid"]),
    );
    expect(mapInquiryValidationDetails(parsed.error.issues, input)).not.toEqual(
      expect.arrayContaining([
        "errors.company.invalid",
        "errors.company.required",
      ]),
    );
  });

  it("maps unregistered attribution fields to errors.generic only", () => {
    const tooLong = inquiryLeadSchema.safeParse({
      ...validBase,
      utmSource: "x".repeat(257),
    });
    const wrongType = inquiryLeadSchema.safeParse({
      ...validBase,
      utmSource: 42,
    });

    expect(tooLong.success).toBe(false);
    expect(wrongType.success).toBe(false);
    if (tooLong.success || wrongType.success) return;

    expect(
      mapInquiryValidationDetails(tooLong.error.issues, {
        ...validBase,
        utmSource: "x".repeat(257),
      }),
    ).toEqual(["errors.generic"]);
    expect(
      mapInquiryValidationDetails(wrongType.error.issues, {
        ...validBase,
        utmSource: 42,
      }),
    ).toEqual(["errors.generic"]);
  });

  it("does not expose phone validation detail keys", () => {
    expect(INQUIRY_FIELD_ERROR_KEYS).not.toHaveProperty("phone");
    expect(INQUIRY_VALIDATION_DETAIL_KEYS).not.toContain(
      "errors.phone.invalid",
    );
  });

  it("keeps emitted details equal to the declared inquiry contract", () => {
    const emitted = new Set<string>();

    for (const input of inquiryFailureInputs) {
      const parsed = inquiryLeadSchema.safeParse(input);
      if (parsed.success) {
        throw new Error(`expected failure for ${JSON.stringify(input)}`);
      }

      for (const detail of mapInquiryValidationDetails(
        parsed.error.issues,
        input,
      )) {
        emitted.add(detail);
      }
    }

    expect([...emitted].sort()).toEqual(
      [...INQUIRY_VALIDATION_DETAIL_KEYS].sort(),
    );
  });

  it("keeps inquiry.form copy for every renderable visible detail key", () => {
    const renderableDetails = INQUIRY_VALIDATION_DETAIL_KEYS.filter(
      (detail) => detail !== "errors.generic",
    );

    for (const detail of renderableDetails) {
      const value = getMessageValue(runtimeMessages, `inquiry.form.${detail}`);
      expect(typeof value, detail).toBe("string");
      expect(String(value).trim(), detail).not.toBe("");
    }
  });

  it("covers errors.generic through the existing field summary copy", () => {
    const fieldSummary = getMessageValue(
      runtimeMessages,
      "inquiry.form.errors.fieldSummary",
    );

    expect(typeof fieldSummary).toBe("string");
    expect(String(fieldSummary).trim()).not.toBe("");
    expect(
      getMessageValue(runtimeMessages, "inquiry.form.errors.generic"),
    ).toBeUndefined();
  });

  it("keeps detail output stable when only the English Zod message changes", () => {
    const structuredIssue = {
      code: "invalid_type" as const,
      path: ["email"],
      message: "Totally different prose",
      expected: "string" as const,
    };
    const legacyIssue = {
      code: "invalid_type" as const,
      path: ["email"],
      message: "Invalid input: expected string, received undefined",
      expected: "string" as const,
    };

    expect(
      mapInquiryValidationDetails([structuredIssue], { email: undefined }),
    ).toEqual(mapInquiryValidationDetails([legacyIssue], { email: undefined }));
  });
});
