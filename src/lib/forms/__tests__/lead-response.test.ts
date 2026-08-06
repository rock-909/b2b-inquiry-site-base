import { describe, expect, it } from "vitest";
import { readLeadReferenceId } from "@/lib/forms/lead-response";

describe("readLeadReferenceId", () => {
  it("returns the reference id for an ok, well-formed success envelope", () => {
    expect(
      readLeadReferenceId(true, {
        success: true,
        data: { referenceId: "lead-ref-1" },
      }),
    ).toBe("lead-ref-1");
  });

  it("returns null when the response is not ok", () => {
    expect(
      readLeadReferenceId(false, {
        success: true,
        data: { referenceId: "ignored" },
      }),
    ).toBeNull();
  });

  it("returns null for a failure envelope", () => {
    expect(
      readLeadReferenceId(true, {
        success: false,
        errorCode: "VALIDATION_FAILED",
      }),
    ).toBeNull();
  });

  it("returns null when the reference id is missing or not a string", () => {
    expect(readLeadReferenceId(true, { success: true, data: {} })).toBeNull();
    expect(
      readLeadReferenceId(true, { success: true, data: { referenceId: 42 } }),
    ).toBeNull();
  });

  it("returns null for non-object payloads", () => {
    expect(readLeadReferenceId(true, null)).toBeNull();
    expect(readLeadReferenceId(true, "boom")).toBeNull();
  });
});
