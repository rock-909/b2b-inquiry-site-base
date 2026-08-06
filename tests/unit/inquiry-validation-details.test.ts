import { describe, expect, it } from "vitest";
import { MAX_LEAD_MESSAGE_LENGTH } from "@/constants/validation-limits";
import { getComposedMessages } from "@/lib/i18n/composed-messages";
import {
  mapInquiryValidationDetails,
  PRODUCT_INQUIRY_FIELD_ERROR_KEYS,
  PRODUCT_INQUIRY_VALIDATION_DETAIL_KEYS,
} from "@/lib/api/inquiry-validation-details";
import { mapZodIssuesToValidationDetails } from "@/lib/api/validation-error-details";
import {
  PRODUCT_INQUIRY_KINDS,
  PRODUCT_LEAD_TYPE,
  productLeadSchema,
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

const runtimeMessages = getComposedMessages("en");

const validBase = {
  type: PRODUCT_LEAD_TYPE,
  productInquiryKind: PRODUCT_INQUIRY_KINDS.GENERAL_RFQ,
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
  { ...validBase, productInquiryKind: undefined },
  { ...validBase, productInquiryKind: "not-a-kind" },
  { ...validBase, productInquiryKind: 1 },
  {
    type: PRODUCT_LEAD_TYPE,
    productInquiryKind: PRODUCT_INQUIRY_KINDS.CATALOG_PRODUCT,
    fullName: "Ada Lovelace",
    email: "ada@example.com",
  },
  {
    ...validBase,
    productInquiryKind: PRODUCT_INQUIRY_KINDS.CATALOG_PRODUCT,
    catalogProductId: "not-real",
  },
  { ...validBase, catalogProductId: "abs-flood-barriers" },
  { ...validBase, buyerInterest: 123 },
  { ...validBase, buyerInterest: "A".repeat(500) },
  { ...validBase, message: 123 },
  { ...validBase, message: "A".repeat(5000) },
  { ...validBase, utmSource: "x".repeat(257) },
  { ...validBase, utmSource: 42 },
  { ...validBase, gclid: true },
];

describe("inquiry validation detail mapping", () => {
  it("accepts message when raw length exceeds max but normalization shrinks below max", () => {
    const rawMessage = `Hello${" ".repeat(MAX_LEAD_MESSAGE_LENGTH)}world`;

    expect(rawMessage.length).toBeGreaterThan(MAX_LEAD_MESSAGE_LENGTH);

    const parsed = productLeadSchema.safeParse({
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
    const tooLong = productLeadSchema.safeParse({
      ...validBase,
      message: "A".repeat(MAX_LEAD_MESSAGE_LENGTH + 1),
    });
    const wrongType = productLeadSchema.safeParse({
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
      company: 123,
      message: 999,
      buyerInterest: 789,
    };
    const parsed = productLeadSchema.safeParse(input);

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(mapInquiryValidationDetails(parsed.error.issues, input)).toEqual(
      expect.arrayContaining(["errors.generic", "errors.message.invalid"]),
    );
    expect(mapInquiryValidationDetails(parsed.error.issues, input)).not.toEqual(
      expect.arrayContaining([
        "errors.company.invalid",
        "errors.buyerInterest.invalid",
        "errors.company.required",
        "errors.buyerInterest.required",
      ]),
    );
  });

  it("maps unregistered attribution fields to errors.generic only", () => {
    const tooLong = productLeadSchema.safeParse({
      ...validBase,
      utmSource: "x".repeat(257),
    });
    const wrongType = productLeadSchema.safeParse({
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
    expect(PRODUCT_INQUIRY_FIELD_ERROR_KEYS).not.toHaveProperty("phone");
    expect(PRODUCT_INQUIRY_VALIDATION_DETAIL_KEYS).not.toContain(
      "errors.phone.invalid",
    );
  });

  it("keeps emitted details equal to the declared inquiry contract", () => {
    const emitted = new Set<string>();

    for (const input of inquiryFailureInputs) {
      const parsed = productLeadSchema.safeParse(input);
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
      [...PRODUCT_INQUIRY_VALIDATION_DETAIL_KEYS].sort(),
    );
  });

  it("keeps inquiry.form copy for every renderable visible detail key", () => {
    const renderableDetails = PRODUCT_INQUIRY_VALIDATION_DETAIL_KEYS.filter(
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

describe("shared zod validation detail mapping", () => {
  it("only treats invalid_type as required when undefined was received", () => {
    const requiredIssue = {
      code: "invalid_type" as const,
      path: ["company"],
      message: "Different required copy",
      expected: "string" as const,
    };
    const wrongTypeIssue = {
      code: "invalid_type" as const,
      path: ["company"],
      message: "Different wrong-type copy",
      expected: "string" as const,
    };

    expect(
      mapZodIssuesToValidationDetails(
        [requiredIssue],
        {
          company: "errors.company",
        },
        { company: undefined },
      ),
    ).toEqual(["errors.company.required"]);

    expect(
      mapZodIssuesToValidationDetails(
        [wrongTypeIssue],
        {
          company: "errors.company",
        },
        { company: 123 },
      ),
    ).toEqual(["errors.company.invalid"]);
  });

  it("keeps unregistered fields on errors.generic without suffixes", () => {
    expect(
      mapZodIssuesToValidationDetails(
        [
          {
            code: "too_big",
            path: ["utmSource"],
            message: "Too big",
          } as never,
        ],
        {},
      ),
    ).toEqual(["errors.generic"]);
  });
});
