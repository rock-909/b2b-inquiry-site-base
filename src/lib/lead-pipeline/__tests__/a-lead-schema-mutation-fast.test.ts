import { describe, expect, it } from "vitest";
import { INQUIRY_LEAD_TYPE, inquiryLeadSchema } from "../lead-schema";

const BASE = {
  type: INQUIRY_LEAD_TYPE,
  fullName: "Mutation Tester",
  email: "mutation@example.com",
} as const;

describe("product lead schema mutation guards", () => {
  it.each([null, true, 42, [], {}])(
    "rejects invalid message input %j",
    (message) => {
      expect(inquiryLeadSchema.safeParse({ ...BASE, message }).success).toBe(
        false,
      );
    },
  );

  it("accepts omitted buyer text", () => {
    expect(inquiryLeadSchema.safeParse(BASE).success).toBe(true);
  });
});
