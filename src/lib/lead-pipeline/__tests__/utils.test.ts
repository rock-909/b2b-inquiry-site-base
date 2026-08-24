import { describe, expect, it } from "vitest";
import {
  generateLeadReferenceId,
  generateInquiryMessage,
  resolveBuyerMessage,
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
      generateInquiryMessage({
        requirements: "Need custom height\nStainless finish",
      }),
    ).toBe("Requirements: Need custom height\nStainless finish");
  });

  it("omits blank optional message parts", () => {
    expect(
      generateInquiryMessage({
        requirements: "",
      }),
    ).toBe("General inquiry");
  });

  it("resolves only the canonical message", () => {
    expect(resolveBuyerMessage({ message: "  Buyer note  " })).toBe(
      "Buyer note",
    );
    expect(resolveBuyerMessage({ message: "   " })).toBeUndefined();
    expect(resolveBuyerMessage({})).toBeUndefined();
  });

  it("generates inquiry-shaped unique reference ids", () => {
    const first = generateLeadReferenceId("inquiry");
    const second = generateLeadReferenceId("inquiry");

    expect(first).toMatch(/^INQ-[a-z0-9]+-[a-f0-9]{8}$/);
    expect(second).not.toBe(first);
  });
});
