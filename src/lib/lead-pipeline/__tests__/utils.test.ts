import { describe, expect, it } from "vitest";
import { generateLeadReferenceId, splitName } from "../utils";

describe("lead pipeline utils", () => {
  it.each([
    ["John Doe", { firstName: "John", lastName: "Doe" }],
    ["Madonna", { firstName: "Madonna", lastName: "" }],
    ["  Jane   Mary Buyer  ", { firstName: "Jane Mary", lastName: "Buyer" }],
  ])("splits %j", (fullName, expected) => {
    expect(splitName(fullName)).toEqual(expected);
  });

  it("generates inquiry-shaped unique reference ids", () => {
    const first = generateLeadReferenceId();
    const second = generateLeadReferenceId();

    expect(first).toMatch(/^INQ-[a-z0-9]+-[a-f0-9]{8}$/);
    expect(second).not.toBe(first);
  });
});
