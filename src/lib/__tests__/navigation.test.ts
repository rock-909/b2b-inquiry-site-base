import { describe, expect, it, vi } from "vitest";
import { PUBLIC_STATIC_PAGE_DEFINITIONS } from "@/config/pages.config";
import { SINGLE_SITE_NAVIGATION } from "@/config/single-site-navigation";
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
  describe("main navigation", () => {
    it("lists pages with a navigationKey in registry order, home first, leaving contact to the header CTA", () => {
      expect(SINGLE_SITE_NAVIGATION.map((item) => item.href)).toEqual(
        PUBLIC_STATIC_PAGE_DEFINITIONS.filter(
          (page) => page.navigationKey !== null && page.path !== "/contact",
        ).map((page) => page.path),
      );
      expect(SINGLE_SITE_NAVIGATION[0]).toEqual({
        key: "home",
        href: "/",
        messageKey: "home",
      });
    });
  });

  // 每行一个 (当前路径, 导航项路径, 是否高亮)；高亮决定 aria-current。
  describe("isActivePath", () => {
    it.each([
      // 根路径只匹配根，以及默认 locale 的根
      ["/", "/", true],
      ["/en", "/", true],
      ["", "/", true],
      ["/fr", "/", false],
      ["/about", "/", false],
      ["/en/about", "/", false],
      ["/fr/products", "/", false],
      // 精确匹配；只剥离已配置的 locale 前缀
      ["/about", "/about", true],
      ["/en/about", "/about", true],
      ["/fr/about", "/about", false],
      // 子路径
      ["/about/team", "/about", true],
      ["/en/about/team", "/about", true],
      ["/fr/products/enterprise", "/products", false],
      // 不匹配
      ["/about", "/products", false],
      ["/en/about", "/products", false],
      ["/fr/services", "/products", false],
      // 尾斜杠
      ["/about/", "/about", true],
      ["/en/about/", "/about", true],
      ["/about/team", "/about/", true],
      ["/en/about/team", "/about/", true],
      ["/fr/products/enterprise", "/products/", false],
      // 不按字符串前缀匹配半个路径段
      ["/aboutus", "/about", false],
      ["/en/aboutus", "/about", false],
      // 只剥离完整的 locale 段
      ["/enquiry", "/enquiry", true],
      ["/engineering/pumps", "/engineering", true],
      ["/estimate", "/estimate", true],
      ["/enquiry", "/", false],
    ] as const)("isActivePath(%j, %j) is %s", (current, item, expected) => {
      expect(isActivePath(current, item)).toBe(expected);
    });
  });
});
