import { describe, expect, it, vi } from "vitest";
import { TEST_OFFERING } from "@/test/offerings";
import { INQUIRY_LEAD_TYPE, inquiryLeadSchema } from "../lead-schema";

vi.mock("@/config/offerings", async () => import("@/test/offerings"));

const GENERAL_INQUIRY = {
  type: INQUIRY_LEAD_TYPE,
  fullName: "Jane Buyer",
  email: "jane@example.com",
  message: "Need a custom component for a warehouse project.",
} as const;
describe("inquiryLeadSchema", () => {
  it("accepts a general inquiry without offering identity", () => {
    const result = inquiryLeadSchema.parse(GENERAL_INQUIRY);

    expect(result).toEqual(GENERAL_INQUIRY);
  });

  it("accepts a configured offering inquiry", () => {
    const result = inquiryLeadSchema.parse({
      ...GENERAL_INQUIRY,
      offeringId: TEST_OFFERING.id,
      interest: "OEM branding",
    });

    expect(result.offeringId).toBe(TEST_OFFERING.id);
    expect(result.interest).toBe("OEM branding");
  });

  it("rejects invalid offering identity", () => {
    expect(
      inquiryLeadSchema.safeParse({
        ...GENERAL_INQUIRY,
        offeringId: "not-an-offering",
      }).success,
    ).toBe(false);
  });

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

  it("allows general inquiry but rejects offering ids when no offerings are configured", async () => {
    vi.resetModules();
    vi.doMock("@/config/offerings", () => ({
      OFFERINGS: [],
      getOfferingById: () => undefined,
    }));
    const { INQUIRY_LEAD_TYPE: leadType, inquiryLeadSchema: schema } =
      await import("../lead-schema");

    expect(
      schema.safeParse({
        type: leadType,
        fullName: "Ada Buyer",
        email: "ada@example.com",
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        type: leadType,
        fullName: "Ada Buyer",
        email: "ada@example.com",
        offeringId: TEST_OFFERING.id,
      }).success,
    ).toBe(false);

    vi.doUnmock("@/config/offerings");
  });
});
