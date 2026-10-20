import { describe, expect, it } from "vitest";
import { FONT_FAMILY } from "@/emails/theme";

describe("email FONT_FAMILY", () => {
  it("keeps the generic family last so specific fonts still apply", () => {
    // A generic family (e.g. sans-serif) must not precede other families,
    // otherwise CSS stops evaluating the fallback list and later fonts never
    // apply.
    expect(FONT_FAMILY).not.toContain("sans-serif,");
    expect(FONT_FAMILY.trim().endsWith("sans-serif")).toBe(true);
  });
});
