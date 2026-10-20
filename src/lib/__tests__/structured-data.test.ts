import { describe, expect, it } from "vitest";
import { generateJSONLD } from "../structured-data";

describe("Structured Data - JSON-LD", () => {
  describe("generateJSONLD", () => {
    it("should escape < characters to prevent XSS attacks", () => {
      const maliciousData = {
        "@context": "https://schema.org",
        "@type": "Article",
        name: 'Test</script><script>alert("XSS")</script>',
        description: "Content with <b>HTML</b> tags",
      };

      const result = generateJSONLD(maliciousData);

      // 所有 < 字符应被转义为 <
      expect(result).not.toContain("</script>");
      expect(result).not.toContain("<script>");
      expect(result).not.toContain("<b>");
      expect(result).toContain("\\u003c/script\\u003e");
      expect(result).toContain("\\u003cscript\\u003e");
      expect(result).toContain("\\u003cb\\u003e");

      // 转义后的字符串仍然是有效的 JSON
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      // JSON.parse 会自动将 < 解码回 <
      expect(parsed.name).toBe('Test</script><script>alert("XSS")</script>');
      expect(parsed.description).toBe("Content with <b>HTML</b> tags");
    });

    it("should escape other HTML-sensitive characters and JS line separators", () => {
      const riskyData = {
        "@context": "https://schema.org",
        "@type": "Thing",
        name: "A > B & C",
        description: "Line one line two line three",
      };

      const result = generateJSONLD(riskyData);

      expect(result).toContain("\\u003e");
      expect(result).toContain("\\u0026");
      expect(result).toContain("\\u2028");
      expect(result).toContain("\\u2029");
      expect(result).not.toContain(" ");
      expect(result).not.toContain(" ");

      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.name).toBe("A > B & C");
      expect(parsed.description).toBe("Line one line two line three");
    });
  });
});
