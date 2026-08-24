import { describe, expect, it, vi } from "vitest";
import { INQUIRY_LEAD_TYPE, inquiryLeadSchema } from "../lead-schema";

vi.mock("@/config/offerings", async () => import("@/test/offerings"));

const BASE_GENERAL_INQUIRY = {
  type: INQUIRY_LEAD_TYPE,
  fullName: "Jane Buyer",
  email: "jane@example.com",
} as const;

const GENERAL_INQUIRY = {
  ...BASE_GENERAL_INQUIRY,
  message: "Need a custom component for a warehouse project.",
} as const;
describe("inquiryLeadSchema", () => {
  it("accepts a general inquiry without offering identity", () => {
    const result = inquiryLeadSchema.parse(GENERAL_INQUIRY);

    expect(result).toEqual(GENERAL_INQUIRY);
  });

  it("accepts omitted buyer text", () => {
    expect(inquiryLeadSchema.safeParse(BASE_GENERAL_INQUIRY).success).toBe(
      true,
    );
  });

  it.each([[null], [true], [42], [[]], [{}]])(
    "rejects invalid message input %j",
    (message) => {
      expect(
        inquiryLeadSchema.safeParse({
          ...BASE_GENERAL_INQUIRY,
          message,
        }).success,
      ).toBe(false);
    },
  );

  it("preserves canonical multiline message and attribution", () => {
    const result = inquiryLeadSchema.parse({
      ...GENERAL_INQUIRY,
      message: "Line one\nLine two",
      utmSource: "google",
      landingPage: "/request-quote",
    });

    expect(result.message).toBe("Line one\nLine two");
    expect(result.utmSource).toBe("google");
    expect(result.landingPage).toBe("/request-quote");
  });

});
