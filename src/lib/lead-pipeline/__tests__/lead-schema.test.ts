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
      landingPage: "/contact",
    });

    expect(result.message).toBe("Line one\nLine two");
    expect(result.utmSource).toBe("google");
    expect(result.landingPage).toBe("/contact");
  });

  it.each([
    ["punycode TLD", "buyer@example.xn--p1ai"],
    ["ampersand in local part", "r&d@example.com"],
    ["hash in local part", "sales#eu@example.com"],
  ])("accepts a browser-valid address with %s", (_label, email) => {
    const result = inquiryLeadSchema.safeParse({
      ...BASE_GENERAL_INQUIRY,
      email,
    });

    expect(result.success).toBe(true);
    expect(result.data?.email).toBe(email);
  });

  it.each([
    ["dotless domain", "a@b"],
    ["single-letter TLD", "a@example.c"],
    ["formula prefix =", "=cmd@example.com"],
    ["formula prefix +", "+cmd@example.com"],
    ["formula prefix -", "-cmd@example.com"],
    ["formula prefix @", "@cmd@example.com"],
    ["empty punycode label", "a@example.xn--"],
  ])("rejects an address with %s", (_label, email) => {
    expect(
      inquiryLeadSchema.safeParse({ ...BASE_GENERAL_INQUIRY, email }).success,
    ).toBe(false);
  });
});
