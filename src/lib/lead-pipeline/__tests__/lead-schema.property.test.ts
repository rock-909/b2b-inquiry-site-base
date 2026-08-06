import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  PRODUCT_INQUIRY_KINDS,
  PRODUCT_LEAD_TYPE,
  productLeadSchema,
} from "../lead-schema";

describe("productLeadSchema properties", () => {
  it("safeParse never throws for arbitrary input", () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        expect(() => productLeadSchema.safeParse(input)).not.toThrow();
      }),
    );
  });

  it("rejects non-email-shaped values", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,48}$/), (email) => {
        const result = productLeadSchema.safeParse({
          type: PRODUCT_LEAD_TYPE,
          productInquiryKind: PRODUCT_INQUIRY_KINDS.GENERAL_RFQ,
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
          const result = productLeadSchema.parse({
            type: PRODUCT_LEAD_TYPE,
            productInquiryKind: PRODUCT_INQUIRY_KINDS.GENERAL_RFQ,
            fullName: "Jane Buyer",
            email: "jane@example.com",
            company,
            quantity,
            requirements,
          });

          expect(result).not.toHaveProperty("company");
          expect(result).not.toHaveProperty("quantity");
          expect(result).not.toHaveProperty("requirements");
        },
      ),
    );
  });
});
