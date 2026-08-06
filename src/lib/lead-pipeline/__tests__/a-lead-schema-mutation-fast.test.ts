import { describe, expect, it } from "vitest";
import {
  PRODUCT_INQUIRY_KINDS,
  PRODUCT_LEAD_TYPE,
  productLeadSchema,
} from "../lead-schema";

const BASE = {
  type: PRODUCT_LEAD_TYPE,
  productInquiryKind: PRODUCT_INQUIRY_KINDS.GENERAL_RFQ,
  fullName: "Mutation Tester",
  email: "mutation@example.com",
} as const;

describe("product lead schema mutation guards", () => {
  it.each([null, true, 42, [], {}])(
    "rejects invalid message input %j",
    (message) => {
      expect(productLeadSchema.safeParse({ ...BASE, message }).success).toBe(
        false,
      );
    },
  );

  it("accepts omitted buyer text", () => {
    expect(productLeadSchema.safeParse(BASE).success).toBe(true);
  });
});
