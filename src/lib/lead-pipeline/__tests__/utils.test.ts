import { describe, expect, it } from "vitest";
import {
  composeInquiryDescription,
  generateLeadReferenceId,
  generateProductInquiryMessage,
  resolveProductBuyerText,
  splitName,
} from "../utils";

describe("lead pipeline utils", () => {
  it.each([
    ["John Doe", { firstName: "John", lastName: "Doe" }],
    ["Madonna", { firstName: "Madonna", lastName: "" }],
    ["  Jane   Mary Buyer  ", { firstName: "Jane Mary", lastName: "Buyer" }],
  ])("splits %j", (fullName, expected) => {
    expect(splitName(fullName)).toEqual(expected);
  });

  it("builds the canonical Airtable message without quantity", () => {
    expect(
      generateProductInquiryMessage({
        productName: "ABS Interlocking Boxwall",
        buyerInterest: "OEM branding",
        requirements: "Need custom height\nStainless finish",
      }),
    ).toBe(
      "Product: ABS Interlocking Boxwall\nInterest: OEM branding\nRequirements: Need custom height\nStainless finish",
    );
  });

  it("omits blank optional message parts", () => {
    expect(
      generateProductInquiryMessage({
        productName: "General RFQ",
        buyerInterest: " ",
        requirements: "",
      }),
    ).toBe("Product: General RFQ");
  });

  it("combines buyer interest with canonical message for email", () => {
    expect(
      composeInquiryDescription({
        buyerInterest: "OEM branding",
        requirements: "Need 50 units",
      }),
    ).toBe("Interest: OEM branding\nNeed 50 units");
  });

  it("resolves only the canonical message", () => {
    expect(resolveProductBuyerText({ message: "  Buyer note  " })).toBe(
      "Buyer note",
    );
    expect(resolveProductBuyerText({ message: "   " })).toBeUndefined();
    expect(resolveProductBuyerText({})).toBeUndefined();
  });

  it("generates product-shaped unique reference ids", () => {
    const first = generateLeadReferenceId("product");
    const second = generateLeadReferenceId("product");

    expect(first).toMatch(/^PRO-[a-z0-9]+-[a-f0-9]{8}$/);
    expect(second).not.toBe(first);
  });
});
