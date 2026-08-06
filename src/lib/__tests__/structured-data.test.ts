import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateJSONLD } from "../structured-data";
import * as structuredDataPublicApi from "../structured-data";

describe("Structured Data - JSON-LD", () => {
  describe("public structured-data API", () => {
    it("does not expose legacy FAQ or breadcrumb schema aliases", () => {
      expect("generateFAQSchema" in structuredDataPublicApi).toBe(false);
      expect("generateBreadcrumbSchema" in structuredDataPublicApi).toBe(false);
    });

    it("keeps schema context literals out of the compatibility module", () => {
      const structuredDataSource = readFileSync(
        join(process.cwd(), "src/lib/structured-data.ts"),
        "utf8",
      );

      expect(structuredDataSource).not.toContain(
        '"@context": "https://schema.org"',
      );
    });
  });

  describe("generateJSONLD", () => {
    it("should generate valid JSON-LD string", () => {
      const testData = {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Test Organization",
      };

      const result = generateJSONLD(testData);

      // 结果应该是有效的 JSON（转义字符会被正确解析）
      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed["@context"]).toBe("https://schema.org");
      expect(parsed["@type"]).toBe("Organization");
      expect(parsed.name).toBe("Test Organization");
    });

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

    it("should handle data without < characters unchanged", () => {
      const safeData = {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Safe Organization Name",
        url: "https://example.com",
      };

      const result = generateJSONLD(safeData);

      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.name).toBe("Safe Organization Name");
      expect(parsed.url).toBe("https://example.com");
    });

    it("should handle complex nested objects", () => {
      const complexData = {
        "@context": "https://schema.org",
        "@type": "Article",
        author: {
          "@type": "Person",
          name: "John Doe",
        },
        publisher: {
          "@type": "Organization",
          name: "Test Publisher",
          logo: {
            "@type": "ImageObject",
            url: "https://example.com/images/logo.svg",
          },
        },
      };

      const result = generateJSONLD(complexData);

      expect(result).toContain('"@context": "https://schema.org"');
      expect(result).toContain('"@type": "Article"');
      expect(result).toContain('"name": "John Doe"');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it("should handle null and undefined values", () => {
      const dataWithNulls = {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Test",
        description: null,
        url: undefined,
      };

      const result = generateJSONLD(dataWithNulls);

      expect(() => JSON.parse(result)).not.toThrow();
      const parsed = JSON.parse(result);
      expect(parsed.description).toBeNull();
      expect(parsed).not.toHaveProperty("url");
    });

    it("should handle empty objects and arrays", () => {
      const emptyData = {};
      const result = generateJSONLD(emptyData);

      expect(result).toBe("{}");
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });
});
