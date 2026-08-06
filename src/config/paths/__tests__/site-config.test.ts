import { afterEach, describe, expect, it, vi } from "vitest";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";
import {
  getUnconfiguredPlaceholders,
  isBaseUrlConfigured,
  isPlaceholder,
  SITE_CONFIG,
  validateSiteConfig,
  type SiteConfig,
} from "../site-config";

describe("site-config", () => {
  const PLACEHOLDER_CONFIG = {
    baseUrl: "https://example.com",
    name: "[PROJECT_NAME]",
    description: "Modern B2B Enterprise Web Platform with Next.js",
    seo: {
      titleTemplate: "%s | [PROJECT_NAME]",
      defaultTitle: "[PROJECT_NAME]",
      defaultDescription: "Modern B2B Enterprise Web Platform with Next.js",
    },
    social: {
      twitter: "[TWITTER_URL]",
      linkedin: "[LINKEDIN_URL]",
    },
    contact: {
      phone: "+1-555-0123",
      email: "[CONTACT_EMAIL]",
    },
  } as const satisfies SiteConfig;

  describe("SITE_CONFIG", () => {
    it("should export SITE_CONFIG object", () => {
      expect(SITE_CONFIG).toBeDefined();
      expect(SITE_CONFIG).toBe(SINGLE_SITE_CONFIG);
      expect(typeof SITE_CONFIG.baseUrl).toBe("string");
      expect(typeof SITE_CONFIG.name).toBe("string");
    });

    it("should have required nested structures", () => {
      expect(SITE_CONFIG.seo).toBeDefined();
      expect(SITE_CONFIG.social).toBeDefined();
      expect(SITE_CONFIG.contact).toBeDefined();
    });
  });

  describe("isPlaceholder", () => {
    it("should return true for placeholder values", () => {
      expect(isPlaceholder("[PROJECT_NAME]")).toBe(true);
      expect(isPlaceholder("[TWITTER_URL]")).toBe(true);
      expect(isPlaceholder("[CONTACT_EMAIL]")).toBe(true);
      expect(isPlaceholder("[ANY_PLACEHOLDER]")).toBe(true);
    });

    it("should return false for non-placeholder values", () => {
      expect(isPlaceholder("My Company")).toBe(false);
      expect(isPlaceholder("https://twitter.com/mycompany")).toBe(false);
      expect(isPlaceholder("contact@example.com")).toBe(false);
      expect(isPlaceholder("")).toBe(false);
    });

    it("should return false for partial bracket patterns", () => {
      expect(isPlaceholder("[incomplete")).toBe(false);
      expect(isPlaceholder("incomplete]")).toBe(false);
      expect(isPlaceholder("text [PLACEHOLDER] text")).toBe(false);
    });
  });

  describe("isBaseUrlConfigured", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("should return true in non-production environment", () => {
      vi.stubEnv("NODE_ENV", "development");
      expect(isBaseUrlConfigured()).toBe(true);
    });

    it("should return true in test environment", () => {
      vi.stubEnv("NODE_ENV", "test");
      expect(isBaseUrlConfigured()).toBe(true);
    });

    it("should return false in production when baseUrl contains example.com", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(isBaseUrlConfigured("https://example.com")).toBe(false);
    });

    it("should return false for current production placeholders and workers.dev", () => {
      vi.stubEnv("NODE_ENV", "production");
      const rejected = [
        "https://tucsenberg-site-production.example.invalid",
        "https://example.com",
        "https://sub.example.org",
        "http://localhost:3000",
        "http://127.0.0.1:8787",
        "https://tucsenberg-site-preview.faints-pudgier-9r.workers.dev",
      ];
      for (const url of rejected) {
        expect(isBaseUrlConfigured(url), url).toBe(false);
      }
    });

    it("should return true for real public domains in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(isBaseUrlConfigured("https://tucsenberg.com")).toBe(true);
      expect(isBaseUrlConfigured("https://www.tucsenberg.com")).toBe(true);
    });

    it("should reject reserved .test hosts and non-origin URLs in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(isBaseUrlConfigured("https://showcase-website-starter.test")).toBe(
        false,
      );
      expect(isBaseUrlConfigured("http://tucsenberg.com")).toBe(false);
      expect(isBaseUrlConfigured("https://tucsenberg.com/path")).toBe(false);
    });
  });

  describe("getUnconfiguredPlaceholders", () => {
    it("should return array of placeholder objects", () => {
      const placeholders = getUnconfiguredPlaceholders();
      expect(Array.isArray(placeholders)).toBe(true);
    });

    it("should include path and value for each placeholder", () => {
      const placeholders = getUnconfiguredPlaceholders();
      for (const placeholder of placeholders) {
        expect(placeholder).toHaveProperty("path");
        expect(placeholder).toHaveProperty("value");
        expect(typeof placeholder.path).toBe("string");
        expect(typeof placeholder.value).toBe("string");
      }
    });

    it("should detect placeholder in SITE_CONFIG.name", () => {
      const placeholders = getUnconfiguredPlaceholders(PLACEHOLDER_CONFIG);
      const namePlaceholder = placeholders.find(
        (p) => p.path === "SITE_CONFIG.name",
      );
      expect(namePlaceholder).toBeDefined();
      expect(namePlaceholder?.value).toBe(PLACEHOLDER_CONFIG.name);
    });

    it("should detect placeholder in SITE_CONFIG.seo.defaultTitle", () => {
      const placeholders = getUnconfiguredPlaceholders(PLACEHOLDER_CONFIG);
      const titlePlaceholder = placeholders.find(
        (p) => p.path === "SITE_CONFIG.seo.defaultTitle",
      );
      expect(titlePlaceholder).toBeDefined();
    });

    it("should detect placeholder in social links", () => {
      const placeholders = getUnconfiguredPlaceholders(PLACEHOLDER_CONFIG);
      const socialPaths = [
        "SITE_CONFIG.social.twitter",
        "SITE_CONFIG.social.linkedin",
      ];

      for (const path of socialPaths) {
        const key = path.split(".").pop() as keyof typeof SITE_CONFIG.social;
        const found = placeholders.find((p) => p.path === path);
        expect(found).toBeDefined();
        expect(found?.value).toBe(PLACEHOLDER_CONFIG.social[key]);
      }
    });

    it("should detect placeholder in contact email", () => {
      const placeholders = getUnconfiguredPlaceholders(PLACEHOLDER_CONFIG);
      const emailPlaceholder = placeholders.find(
        (p) => p.path === "SITE_CONFIG.contact.email",
      );
      expect(emailPlaceholder).toBeDefined();
    });

    it("should detect titleTemplate containing [PROJECT_NAME]", () => {
      const placeholders = getUnconfiguredPlaceholders(PLACEHOLDER_CONFIG);
      const templatePlaceholder = placeholders.find(
        (p) => p.path === "SITE_CONFIG.seo.titleTemplate",
      );
      expect(templatePlaceholder).toBeDefined();
    });
  });

  describe("validateSiteConfig", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("should return validation result object", () => {
      const result = validateSiteConfig();
      expect(result).toHaveProperty("valid");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("warnings");
      expect(typeof result.valid).toBe("boolean");
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it("should return warnings in non-production environment", () => {
      vi.stubEnv("NODE_ENV", "development");
      const result = validateSiteConfig(PLACEHOLDER_CONFIG);
      // In development, placeholders generate warnings not errors
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should have valid=true when errors array is empty", () => {
      vi.stubEnv("NODE_ENV", "development");
      const result = validateSiteConfig(PLACEHOLDER_CONFIG);
      expect(result.valid).toBe(result.errors.length === 0);
    });

    it("should include placeholder paths in warning messages", () => {
      vi.stubEnv("NODE_ENV", "development");
      const result = validateSiteConfig(PLACEHOLDER_CONFIG);
      const placeholders = getUnconfiguredPlaceholders(PLACEHOLDER_CONFIG);

      for (const placeholder of placeholders) {
        const hasWarning = result.warnings.some((w) =>
          w.includes(placeholder.path),
        );
        expect(hasWarning).toBe(true);
      }
    });

    it("should not add baseUrl warning in development (isBaseUrlConfigured returns true)", () => {
      vi.stubEnv("NODE_ENV", "development");
      const result = validateSiteConfig(PLACEHOLDER_CONFIG);
      // In development, isBaseUrlConfigured() returns true, so no baseUrl warning
      const hasBaseUrlWarning = result.warnings.some((w) =>
        w.includes("SITE_CONFIG.baseUrl"),
      );
      expect(hasBaseUrlWarning).toBe(false);
    });

    it("should return errors in production environment for placeholders", () => {
      vi.stubEnv("NODE_ENV", "production");
      const result = validateSiteConfig(PLACEHOLDER_CONFIG);
      // In production, placeholders generate errors not warnings
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should add baseUrl error in production when not configured", () => {
      vi.stubEnv("NODE_ENV", "production");
      const result = validateSiteConfig(PLACEHOLDER_CONFIG);
      // In production with example.com baseUrl, should have baseUrl error
      const hasBaseUrlError = result.errors.some((e) =>
        e.includes("SITE_CONFIG.baseUrl"),
      );
      expect(hasBaseUrlError).toBe(true);
    });

    it("should include placeholder paths in error messages in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      const result = validateSiteConfig(PLACEHOLDER_CONFIG);
      const placeholders = getUnconfiguredPlaceholders(PLACEHOLDER_CONFIG);

      for (const placeholder of placeholders) {
        const hasError = result.errors.some((e) =>
          e.includes(placeholder.path),
        );
        expect(hasError).toBe(true);
      }
    });

    it("should return valid result when production config is configured", () => {
      vi.stubEnv("NODE_ENV", "production");
      const configuredConfig = {
        ...SITE_CONFIG,
        baseUrl: "https://tucsenberg.com",
      } satisfies SiteConfig;
      const result = validateSiteConfig(configuredConfig);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });
});
