import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { INQUIRY_LEAD_TYPE, inquiryLeadSchema } from "../lead-schema";

describe("inquiryLeadSchema properties", () => {
  it("safeParse never throws for arbitrary input", () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        expect(() => inquiryLeadSchema.safeParse(input)).not.toThrow();
      }),
    );
  });

  it("rejects non-email-shaped values", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,48}$/), (email) => {
        const result = inquiryLeadSchema.safeParse({
          type: INQUIRY_LEAD_TYPE,
          fullName: "Jane Buyer",
          email,
        });

        expect(result.success).toBe(false);
      }),
    );
  });

  it("never retains retired input properties", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer(),
        fc.string(),
        (company, quantity, requirements) => {
          const result = inquiryLeadSchema.parse({
            type: INQUIRY_LEAD_TYPE,
            fullName: "Jane Buyer",
            email: "jane@example.com",
            company,
            quantity,
            requirements,
            productInquiryKind: "general-rfq",
            catalogProductId: "abs-flood-barriers",
            buyerInterest: "retired",
          });

          expect(result).not.toHaveProperty("company");
          expect(result).not.toHaveProperty("quantity");
          expect(result).not.toHaveProperty("requirements");
          expect(result).not.toHaveProperty("productInquiryKind");
          expect(result).not.toHaveProperty("catalogProductId");
          expect(result).not.toHaveProperty("buyerInterest");
        },
      ),
    );
  });
});
