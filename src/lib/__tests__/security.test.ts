import { describe, expect, it } from "vitest";
import { sanitizePlainText } from "@/lib/security/validation";

describe("Security Utils", () => {
  describe("sanitizePlainText", () => {
    it("should preserve buyer text and protocol-like substrings", () => {
      expect(sanitizePlainText('<script>alert("xss")</script>')).toBe(
        '<script>alert("xss")</script>',
      );
      expect(sanitizePlainText('javascript:alert("xss")')).toBe(
        'javascript:alert("xss")',
      );
      expect(sanitizePlainText('onclick=alert("xss")')).toBe(
        'onclick=alert("xss")',
      );
      expect(
        sanitizePlainText('data:text/html,<script>alert("xss")</script>'),
      ).toBe('data:text/html,<script>alert("xss")</script>');
    });

    it("should handle non-string input", () => {
      expect(sanitizePlainText(null as unknown as string)).toBe("");
      expect(sanitizePlainText(undefined as unknown as string)).toBe("");
      expect(sanitizePlainText(123 as unknown as string)).toBe("");
    });

    it("should preserve safe content", () => {
      expect(sanitizePlainText("Hello World")).toBe("Hello World");
      expect(sanitizePlainText("user@example.com")).toBe("user@example.com");
      expect(sanitizePlainText("Some text with spaces")).toBe(
        "Some text with spaces",
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
});
