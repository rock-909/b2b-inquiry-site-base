import { beforeEach, describe, expect, it, vi } from "vitest";
import LocaleLayout from "../layout";

const {
  mockGetFontClassNames,
  mockNotFound,
  mockRootLocale,
  mockSetRequestLocale,
} = vi.hoisted(() => ({
  mockGetFontClassNames: vi.fn(() => ""),
  mockNotFound: vi.fn(),
  mockRootLocale: vi.fn(async () => "en"),
  mockSetRequestLocale: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(),
  setRequestLocale: mockSetRequestLocale,
}));

vi.mock("next/navigation", () => ({ notFound: mockNotFound }));
vi.mock("next/root-params", () => ({ locale: mockRootLocale }));
vi.mock("@/app/[locale]/layout-fonts", () => ({
  getFontClassNames: mockGetFontClassNames,
}));
vi.mock("@/i18n/locale-utils", () => ({
  coerceLocale: (locale: string) => locale,
  isLocale: (locale: string) => locale === "en",
}));

describe("LocaleLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFontClassNames.mockReturnValue("");
    mockRootLocale.mockResolvedValue("en");
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

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

  it("wires the locale, font class, and outer document shell", async () => {
    mockGetFontClassNames.mockReturnValue("font-contract-sentinel");

    const page = await LocaleLayout({
      children: <div>Child</div>,
      params: Promise.resolve({ locale: "en" }),
    });
    const body = page.props.children;

    expect(page.type).toBe("html");
    expect(page.props).toMatchObject({
      lang: "en",
      className: "font-contract-sentinel",
      suppressHydrationWarning: true,
    });
    expect(body.type).toBe("body");
    expect(body.props.className).toBe("flex min-h-dvh flex-col antialiased");
    expect(body.props.children.props.children).toEqual(<div>Child</div>);
    expect(mockGetFontClassNames).toHaveBeenCalledTimes(1);
    expect(mockSetRequestLocale).toHaveBeenCalledWith("en");
  });
});
