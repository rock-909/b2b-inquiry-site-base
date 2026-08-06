import { describe, expect, it } from "vitest";
import { sanitizePlainText } from "@/lib/security/validation";

describe("security-validation", () => {
  it("normalizes plain text input while preserving buyer characters", () => {
    expect(sanitizePlainText("<img onerror=alert(1)>")).toBe(
      "<img onerror=alert(1)>",
    );
    expect(sanitizePlainText("width < 900mm, > 5 units")).toBe(
      "width < 900mm, > 5 units",
    );
    expect(sanitizePlainText("see product metadata: sheet")).toBe(
      "see product metadata: sheet",
    );
    expect(sanitizePlainText("  a\n\n b  ")).toBe("a b");
  });
});
