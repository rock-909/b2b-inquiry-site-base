import type React from "react";
import { cleanup, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderAsyncPage } from "@/test/render-async-page";
import LocaleLayout, { generateMetadata } from "../layout";

// Mock dependencies using vi.hoisted - must be before module imports
const {
  mockGetFontClassNames,
  mockSetRequestLocale,
  mockNotFound,
  mockRootLocale,
  mockGenerateLocaleMetadata,
  mockGeneratePageStructuredData,
} = vi.hoisted(() => ({
  mockGetFontClassNames: vi.fn(() => ""),
  mockSetRequestLocale: vi.fn(),
  mockNotFound: vi.fn(),
  mockRootLocale: vi.fn(async () => "en"),
  mockGenerateLocaleMetadata: vi.fn(),
  mockGeneratePageStructuredData: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async ({ namespace }: { namespace: string }) => {
    const translations: Record<string, string> = {
      contactSales: "Contact sales",
      skipToContent:
        namespace === "accessibility"
          ? "Skip to main content"
          : "skipToContent",
      openMenu: "Open menu",
      closeMenu: "Close menu",
      selectLanguage: "Select language",
      home: namespace === "navigation" ? "Home" : namespace,
    };

    return (key: string) => translations[key] ?? key;
  }),
  setRequestLocale: mockSetRequestLocale,
}));

vi.mock("next-intl", () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
}));

vi.mock("next/root-params", () => ({
  locale: mockRootLocale,
}));

vi.mock("@/components/navigation/navigation-progress-bar", () => ({
  NavigationProgressBar: () => null,
}));

vi.mock("@/app/[locale]/layout-metadata", () => ({
  generateLocaleMetadata: mockGenerateLocaleMetadata,
}));

vi.mock("@/lib/page-structured-data", () => ({
  generatePageStructuredData: mockGeneratePageStructuredData,
}));

vi.mock("@/app/[locale]/layout-fonts", () => ({
  getFontClassNames: mockGetFontClassNames,
}));

vi.mock("@/lib/i18n/load-messages", () => ({
  loadCompleteMessages: vi.fn(async () => ({ common: { ok: "OK" } })),
}));

vi.mock("@/lib/i18n/client-messages", () => ({
  loadClientMessages: vi.fn(async () => ({ navigation: { home: "Home" } })),
}));

vi.mock("@/lib/structured-data", () => ({
  generateJSONLD: () => JSON.stringify({ ok: true }),
}));

vi.mock("@/components/attribution-bootstrap", () => ({
  AttributionBootstrap: () => <div data-testid="attribution-bootstrap" />,
}));

vi.mock("@/components/cookie/lazy-cookie-consent-island", () => ({
  LazyCookieConsentIsland: () => <div data-testid="cookie-consent" />,
}));

vi.mock("@/components/footer/footer", () => ({
  Footer: ({ themeToggleSlot }: { themeToggleSlot?: React.ReactNode }) => (
    <footer data-testid="footer">{themeToggleSlot}</footer>
  ),
}));

vi.mock("@/components/layout/header", () => ({
  Header: () => <header data-testid="header" />,
}));

vi.mock("@/components/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/ui/theme-switcher", () => ({
  ThemeSwitcher: () => <button data-testid="footer-theme-toggle" />,
}));

vi.mock("@/config/footer-links", () => ({
  FOOTER_COLUMNS: [],
}));

vi.mock("@/i18n/locale-utils", () => ({
  coerceLocale: (locale: string) => locale,
  // 跟着生产走：zh 是退役 locale，middleware 对 /zh 直接 404，layout 收不到它。
  isLocale: (locale: string) => locale === "en",
}));

vi.mock("@/lib/navigation", () => ({
  mainNavigation: [{ key: "home", href: "/", messageKey: "home" }],
}));

vi.mock("@/i18n/routing", () => ({
  routing: {
    locales: ["en"],
    defaultLocale: "en",
  },
}));

describe("LocaleLayout", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockGetFontClassNames.mockReturnValue("");
    mockRootLocale.mockResolvedValue("en");
    mockGeneratePageStructuredData.mockResolvedValue({
      organizationData: { "@type": "Organization" },
      websiteData: { "@type": "WebSite" },
    });
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  describe("generateMetadata", () => {
    it("should export generateMetadata from layout-metadata", () => {
      expect(generateMetadata).toBe(mockGenerateLocaleMetadata);
    });
  });

  // 用 "fr" 而不是 "zh"：这里守的是 layout 自己的非法 locale 边界，跟 middleware 的
  // 退役 locale 规则是两件事。没有这条，把 layout 里的 `if (!isLocale(locale))`
  // 整段删掉，这个文件的其他用例照样全绿——它们只传 "en"。
  it("rejects an invalid locale before rendering the shell", async () => {
    mockRootLocale.mockResolvedValue("fr");

    await expect(
      LocaleLayout({
        children: <div>Child</div>,
        params: Promise.resolve({ locale: "fr" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalledTimes(1);
    expect(mockSetRequestLocale).not.toHaveBeenCalled();
  });

  describe("font class wiring", () => {
    it("uses the layout font class helper for the html element", async () => {
      mockGetFontClassNames.mockReturnValue("font-contract-sentinel");

      const page = await LocaleLayout({
        children: <div>Child</div>,
        params: Promise.resolve({ locale: "en" }),
      });

      expect(mockGetFontClassNames).toHaveBeenCalledTimes(1);
      expect(page.props.className).toBe("font-contract-sentinel");
    });
  });

  describe("layout shell", () => {
    it("keeps the core layout shell stable without development-tool scripts", async () => {
      const page = await LocaleLayout({
        children: <div>Child</div>,
        params: Promise.resolve({ locale: "en" }),
      });

      await renderAsyncPage(page);

      expect(screen.getByText("Skip to main content")).toBeInTheDocument();
      expect(document.querySelectorAll("script")).toHaveLength(0);
      expect(mockSetRequestLocale).toHaveBeenCalledWith("en");
    });
  });
});
