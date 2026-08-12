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
});
