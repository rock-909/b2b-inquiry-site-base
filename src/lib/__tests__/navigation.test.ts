import { describe, expect, it, vi } from "vitest";
import { TEST_COUNT_CONSTANTS } from "@/test/constants/test-constants";
import {
  isActivePath,
  mainNavigation,
  mobileNavigation,
  type NavigationItem,
} from "../navigation";
import {
  getSingleSiteNavigation,
  SINGLE_SITE_NAVIGATION,
} from "@/config/single-site-navigation";

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
      const item: NavigationItem = {
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

  describe("mainNavigation", () => {
    it("should forward the canonical single-site navigation source", () => {
      expect(mainNavigation).toBe(SINGLE_SITE_NAVIGATION);
    });

    it("should use the catalog site navigation as the singleton source", () => {
      expect(SINGLE_SITE_NAVIGATION).toEqual(getSingleSiteNavigation());
      expect(mainNavigation).toEqual([
        { key: "home", href: "/", messageKey: "home" },
        {
          key: "products",
          href: "/products",
          messageKey: "products",
        },
        {
          key: "oemWholesale",
          href: "/oem-wholesale",
          messageKey: "oemWholesale",
        },
        {
          key: "materialsGuide",
          href: "/guides/flood-barrier-materials-guide",
          messageKey: "guides",
        },
        { key: "about", href: "/about", messageKey: "about" },
      ]);
    });

    it("can derive the default materialized catalog navigation explicitly", () => {
      expect(getSingleSiteNavigation()).toEqual([
        { key: "home", href: "/", messageKey: "home" },
        {
          key: "products",
          href: "/products",
          messageKey: "products",
        },
        {
          key: "oemWholesale",
          href: "/oem-wholesale",
          messageKey: "oemWholesale",
        },
        {
          key: "materialsGuide",
          href: "/guides/flood-barrier-materials-guide",
          messageKey: "guides",
        },
        { key: "about", href: "/about", messageKey: "about" },
      ]);
    });

    it("should keep optional demo pages and support pages out of the default main navigation", () => {
      const actualKeys = mainNavigation.map((item) => item.key);
      expect(actualKeys).not.toContain("capabilities");
      expect(actualKeys).not.toContain("howItWorks");
      expect(actualKeys).not.toContain("customProject");
      expect(actualKeys).not.toContain("contact");
      expect(actualKeys).not.toContain("privacy");
    });

    it("should have valid structure for all items", () => {
      mainNavigation.forEach((item) => {
        expect(item.key).toBeTruthy();
        expect(item.href).toBeTruthy();
        expect(item.messageKey).toBeTruthy();
        expect(item.href).toMatch(/^\/[a-z-/]*$/);
      });
    });

    it("should have home item pointing to root", () => {
      const homeItem = mainNavigation.find((item) => item.key === "home");
      expect(homeItem).toBeDefined();
      expect(homeItem!.href).toBe("/");
    });

    it("should have unique keys", () => {
      const keys = mainNavigation.map((item) => item.key);
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size);
    });

    it("should have unique hrefs", () => {
      const hrefs = mainNavigation.map((item) => item.href);
      const uniqueHrefs = new Set(hrefs);
      expect(hrefs.length).toBe(uniqueHrefs.size);
    });
  });

  describe("mobileNavigation", () => {
    it("should be the same as mainNavigation", () => {
      expect(mobileNavigation).toBe(mainNavigation);
    });
  });

  describe("isActivePath", () => {
    it("should return true for exact root path match", () => {
      expect(isActivePath("/", "/")).toBe(true);
      expect(isActivePath("/en", "/")).toBe(true);
      expect(isActivePath("/zh", "/")).toBe(false);
    });

    it("should return false for root path when current path is not root", () => {
      expect(isActivePath("/about", "/")).toBe(false);
      expect(isActivePath("/en/about", "/")).toBe(false);
      expect(isActivePath("/zh/products", "/")).toBe(false);
    });

    it("should return true for matching paths", () => {
      expect(isActivePath("/about", "/about")).toBe(true);
      expect(isActivePath("/en/about", "/about")).toBe(true);
      expect(isActivePath("/zh/about", "/about")).toBe(false);
    });

    it("should return true for sub-paths", () => {
      expect(isActivePath("/about/team", "/about")).toBe(true);
      expect(isActivePath("/en/about/team", "/about")).toBe(true);
      expect(isActivePath("/zh/products/enterprise", "/products")).toBe(false);
    });

    it("should return false for non-matching paths", () => {
      expect(isActivePath("/about", "/products")).toBe(false);
      expect(isActivePath("/en/about", "/products")).toBe(false);
      expect(isActivePath("/zh/services", "/products")).toBe(false);
    });

    it("should handle paths with trailing slashes", () => {
      expect(isActivePath("/about/", "/about")).toBe(true);
      expect(isActivePath("/en/about/", "/about")).toBe(true);
    });

    it("should handle edge cases", () => {
      expect(isActivePath("", "/")).toBe(true);
      expect(isActivePath("/en", "/")).toBe(true);
      expect(isActivePath("/zh", "/")).toBe(false);
    });

    it("should not match partial path segments", () => {
      expect(isActivePath("/aboutus", "/about")).toBe(false);
      expect(isActivePath("/en/aboutus", "/about")).toBe(false);
    });

    it("should handle item paths that already end with slash", () => {
      // This test covers line 85 where cleanItemPath already ends with '/'
      expect(isActivePath("/about/team", "/about/")).toBe(true);
      expect(isActivePath("/en/about/team", "/about/")).toBe(true);
      expect(isActivePath("/zh/products/enterprise", "/products/")).toBe(false);
    });
  });

  describe("integration tests", () => {
    it("should work with real navigation items", () => {
      const aboutItem = mainNavigation.find((item) => item.key === "about");
      expect(aboutItem).toBeDefined();

      const isActive = isActivePath("/about", aboutItem!.href);
      expect(isActive).toBe(true);
    });

    it("should handle all navigation items correctly", () => {
      expect(mainNavigation.length).toBeGreaterThan(TEST_COUNT_CONSTANTS.SMALL);

      mainNavigation.forEach((item) => {
        // Test active path detection for each navigation target.
        const isActive = isActivePath(item.href, item.href);
        expect(isActive).toBe(true);
      });
    });
  });
});
