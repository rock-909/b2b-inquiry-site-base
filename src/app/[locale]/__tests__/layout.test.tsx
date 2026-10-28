import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageSuggestion } from "@/components/layout/language-suggestion";
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import { getFlatMessages } from "@/test/i18n-messages";
import LocaleLayout from "../layout";

const { mockNotFound, mockRootLocale } = vi.hoisted(() => ({
  mockNotFound: vi.fn(),
  mockRootLocale: vi.fn(async () => "en"),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound: mockNotFound }));
vi.mock("next/root-params", () => ({ locale: mockRootLocale }));
vi.mock("@/i18n/locale-utils", () => ({
  coerceLocale: (locale: string) => locale,
  isLocale: (locale: string) => locale === "en",
}));

describe("LocaleLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it("wires the locale and outer document shell", async () => {
    const page = await LocaleLayout({
      children: <div>Child</div>,
      params: Promise.resolve({ locale: "en" }),
    });
    const body = page.props.children;

    expect(page.type).toBe("html");
    expect(page.props).toMatchObject({
      lang: "en",
      suppressHydrationWarning: true,
    });
    expect(body.type).toBe("body");
    expect(body.props.children.props.children).toEqual(<div>Child</div>);
  });

  it("hands the client provider only the scoped client messages", async () => {
    vi.mocked(getTranslations).mockResolvedValue(
      ((key: string) => key) as never,
    );
    const page = await LocaleLayout({
      children: <div>Child</div>,
      params: Promise.resolve({ locale: "en" }),
    });
    // body 里是异步内容组件；直接调用它拿到渲染树，不为测试新增导出。
    const content = page.props.children.props.children;
    const tree = await content.type(content.props);
    const provider = (tree.props.children as ReactElement[]).find(
      (child) => child?.type === NextIntlClientProvider,
    ) as ReactElement<{ messages: Record<string, unknown> }> | undefined;

    expect(provider?.props.messages).toHaveProperty("navigation");
    expect(provider?.props.messages).not.toHaveProperty("inquiry");
  });

  it("gives the language prompt each locale's copy from that locale's own messages", async () => {
    vi.mocked(getTranslations).mockResolvedValue(
      ((key: string) => key) as never,
    );
    const page = await LocaleLayout({
      children: <div>Child</div>,
      params: Promise.resolve({ locale: "en" }),
    });
    const content = page.props.children.props.children;
    const tree = await content.type(content.props);
    const provider = (tree.props.children as ReactElement[]).find(
      (child) => child?.type === NextIntlClientProvider,
    ) as ReactElement<{ children: ReactElement<{ children: ReactElement[] }> }>;
    const suggestion = provider.props.children.props.children.find(
      (child) => child?.type === LanguageSuggestion,
    ) as ReactElement<{ copy: Record<string, { message: string }> }>;

    // 当前页面是 en，其他语言的文案也必须来自各自的消息文件，而不是当前语言。
    for (const locale of LOCALES_CONFIG.locales) {
      expect(suggestion.props.copy[locale]?.message).toBe(
        getFlatMessages(locale).get("languageSuggestion.message"),
      );
    }
  });
});
