import { describe, expect, it } from "vitest";
import { INQUIRY_LEAD_TYPE, inquiryLeadSchema } from "../lead-schema";

describe("multiline lead fields", () => {
  it("collapses newlines in the single-line full name", () => {
    const parsed = inquiryLeadSchema.parse({
      type: INQUIRY_LEAD_TYPE,
      fullName: "Jane\nBuyer",
      email: "jane@example.com",
    });

    expect(parsed.fullName).toBe("Jane Buyer");
  });
});
