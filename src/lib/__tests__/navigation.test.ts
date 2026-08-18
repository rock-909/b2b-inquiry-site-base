import { describe, expect, it, vi } from "vitest";
import { SINGLE_SITE_NAVIGATION } from "@/config/single-site-navigation";
import type { SiteNavigationItem } from "@/config/site-types";
import { TEST_COUNT_CONSTANTS } from "@/test/constants/test-constants";
import { isActivePath } from "../navigation";

// Use vi.hoisted to ensure proper mock setup
const { mockLocalesConfig } = vi.hoisted(() => ({
  mockLocalesConfig: {
    locales: ["en"],
    defaultLocale: "en",
    localePrefix: "never",
  },
}));

// Mock the locale config module used by the client-safe navigation helpers.
vi.mock("@/config/paths/locales-config", () => ({
  LOCALES_CONFIG: mockLocalesConfig,
}));

describe("navigation", () => {
  describe("NavigationItem interface", () => {
    it("should have valid NavigationItem structure", () => {
      const item: SiteNavigationItem = {
        key: "test",
        href: "/test",
        messageKey: "home",
        icon: "test-icon",
        external: true,
        children: [],
      };

      expect(item.key).toBe("test");
      expect(item.href).toBe("/test");
      expect(item.messageKey).toBe("home");
      expect(item.icon).toBe("test-icon");
      expect(item.external).toBe(true);
      expect(Array.isArray(item.children)).toBe(true);
    });
  });

  describe("main navigation", () => {
    it("uses the configured public navigation", () => {
      expect(SINGLE_SITE_NAVIGATION).toEqual([
        { key: "home", href: "/", messageKey: "home" },
        { key: "products", href: "/products", messageKey: "products" },
        { key: "about", href: "/about", messageKey: "about" },
        { key: "contact", href: "/contact", messageKey: "contactSales" },
      ]);
    });

    it("should keep optional demo pages and support pages out of the default main navigation", () => {
      const actualKeys = SINGLE_SITE_NAVIGATION.map((item) => item.key);
      expect(actualKeys).not.toContain("capabilities");
      expect(actualKeys).not.toContain("howItWorks");
      expect(actualKeys).not.toContain("customProject");
      expect(actualKeys).not.toContain("privacy");
    });

    it("should have valid structure for all items", () => {
      SINGLE_SITE_NAVIGATION.forEach((item) => {
        expect(item.key).toBeTruthy();
        expect(item.href).toBeTruthy();
        expect(item.messageKey).toBeTruthy();
        expect(item.href).toMatch(/^\/[a-z-/]*$/);
      });
    });

    it("should have home item pointing to root", () => {
      const homeItem = SINGLE_SITE_NAVIGATION.find(
        (item) => item.key === "home",
      );
      expect(homeItem).toBeDefined();
      expect(homeItem!.href).toBe("/");
    });

    it("should have unique keys", () => {
      const keys = SINGLE_SITE_NAVIGATION.map((item) => item.key);
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size);
    });

    it("should have unique hrefs", () => {
      const hrefs = SINGLE_SITE_NAVIGATION.map((item) => item.href);
      const uniqueHrefs = new Set(hrefs);
      expect(hrefs.length).toBe(uniqueHrefs.size);
    });
  });

  describe("isActivePath", () => {
    it("should return true for exact root path match", () => {
      expect(isActivePath("/", "/")).toBe(true);
      expect(isActivePath("/en", "/")).toBe(true);
      expect(isActivePath("/fr", "/")).toBe(false);
    });

    it("should return false for root path when current path is not root", () => {
      expect(isActivePath("/about", "/")).toBe(false);
      expect(isActivePath("/en/about", "/")).toBe(false);
      expect(isActivePath("/fr/products", "/")).toBe(false);
    });

    it("should return true for matching paths", () => {
      expect(isActivePath("/about", "/about")).toBe(true);
      expect(isActivePath("/en/about", "/about")).toBe(true);
      expect(isActivePath("/fr/about", "/about")).toBe(false);
    });

    it("should return true for sub-paths", () => {
      expect(isActivePath("/about/team", "/about")).toBe(true);
      expect(isActivePath("/en/about/team", "/about")).toBe(true);
      expect(isActivePath("/fr/products/enterprise", "/products")).toBe(false);
    });

    it("should return false for non-matching paths", () => {
      expect(isActivePath("/about", "/products")).toBe(false);
      expect(isActivePath("/en/about", "/products")).toBe(false);
      expect(isActivePath("/fr/services", "/products")).toBe(false);
    });

    it("should handle paths with trailing slashes", () => {
      expect(isActivePath("/about/", "/about")).toBe(true);
      expect(isActivePath("/en/about/", "/about")).toBe(true);
    });

    it("should handle edge cases", () => {
      expect(isActivePath("", "/")).toBe(true);
      expect(isActivePath("/en", "/")).toBe(true);
      expect(isActivePath("/fr", "/")).toBe(false);
    });

    it("should not match partial path segments", () => {
      expect(isActivePath("/aboutus", "/about")).toBe(false);
      expect(isActivePath("/en/aboutus", "/about")).toBe(false);
    });

    it("should handle item paths that already end with slash", () => {
      // This test covers line 85 where cleanItemPath already ends with '/'
      expect(isActivePath("/about/team", "/about/")).toBe(true);
      expect(isActivePath("/en/about/team", "/about/")).toBe(true);
      expect(isActivePath("/fr/products/enterprise", "/products/")).toBe(false);
    });
  });

  describe("integration tests", () => {
    it("should work with real navigation items", () => {
      const aboutItem = SINGLE_SITE_NAVIGATION.find(
        (item) => item.key === "about",
      );
      expect(aboutItem).toBeDefined();

      const isActive = isActivePath("/about", aboutItem!.href);
      expect(isActive).toBe(true);
    });

    it("should handle all navigation items correctly", () => {
      expect(SINGLE_SITE_NAVIGATION.length).toBeGreaterThan(
        TEST_COUNT_CONSTANTS.SMALL,
      );

      SINGLE_SITE_NAVIGATION.forEach((item) => {
        // Test active path detection for each navigation target.
        const isActive = isActivePath(item.href, item.href);
        expect(isActive).toBe(true);
      });
    });
  });
});
