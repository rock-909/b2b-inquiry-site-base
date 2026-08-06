import { describe, expect, it } from "vitest";
import { sanitizePlainText } from "@/lib/security/validation";

describe("security-validation", () => {
  describe("sanitizePlainText", () => {
    it("should preserve angle brackets", () => {
      expect(sanitizePlainText("<script>")).toBe("<script>");
      expect(sanitizePlainText("test<div>content</div>")).toBe(
        "test<div>content</div>",
      );
    });

    it("should preserve javascript-like protocol text", () => {
      expect(sanitizePlainText("javascript:alert(1)")).toBe(
        "javascript:alert(1)",
      );
      expect(sanitizePlainText("JAVASCRIPT:void(0)")).toBe(
        "JAVASCRIPT:void(0)",
      );
    });

    it("should preserve event-handler-like text", () => {
      expect(sanitizePlainText("onclick=alert(1)")).toBe("onclick=alert(1)");
      expect(sanitizePlainText('onmouseover="evil()"')).toBe(
        'onmouseover="evil()"',
      );
      expect(sanitizePlainText("ONERROR=hack")).toBe("ONERROR=hack");
    });

    it("should preserve data-like protocol text", () => {
      expect(sanitizePlainText("data:text/html")).toBe("data:text/html");
      expect(sanitizePlainText("DATA:image/png")).toBe("DATA:image/png");
    });

    it("should trim whitespace", () => {
      expect(sanitizePlainText("  test  ")).toBe("test");
      expect(sanitizePlainText("  a\n\n b  ")).toBe("a b");
    });

    it("should return empty string for non-string input", () => {
      expect(sanitizePlainText(123 as unknown as string)).toBe("");
      expect(sanitizePlainText(null as unknown as string)).toBe("");
      expect(sanitizePlainText(undefined as unknown as string)).toBe("");
    });

    it("should preserve combined plain text input", () => {
      expect(
        sanitizePlainText("<script>javascript:onclick=alert(1)</script>"),
      ).toBe("<script>javascript:onclick=alert(1)</script>");
    });

    it("should preserve buyer inquiry specification text", () => {
      expect(sanitizePlainText("width < 900mm, > 5 units")).toBe(
        "width < 900mm, > 5 units",
      );
      expect(sanitizePlainText("see product metadata: sheet")).toBe(
        "see product metadata: sheet",
      );
    });
  });
});
