import React from "react";
import { vi } from "vitest";

// Mock unified constants entry point - 使用importOriginal保留所有原始常量
vi.mock("@/constants", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
  };
});

// Mock next-intl —— 翻译来自真实合成消息包，不是手写清单。这里曾经写死七条
// 导航文案，其中 navigation.services 和 navigation.contact 在三个真实消息包里
// 都不存在：任何断言它们的测试证明的是虚构文案。
vi.mock("next-intl", async () => {
  const { getFlatMessages, lookupMessage } =
    await import("@/test/i18n-messages");
  const messages = getFlatMessages();

  return {
    useTranslations: vi.fn(
      (namespace?: string) => (key: string) =>
        lookupMessage(messages, namespace ? `${namespace}.${key}` : key),
    ),
    useLocale: vi.fn(() => "en"),
    useMessages: vi.fn(() => ({})),
    useFormatter: vi.fn(() => ({
      dateTime: vi.fn(),
      number: vi.fn(),
      relativeTime: vi.fn(),
    })),
    NextIntlClientProvider: ({
      children,
    }: {
      children: React.ReactNode;
      locale?: string;
      messages?: Record<string, unknown>;
    }) => React.createElement(React.Fragment, null, children),
  };
});

// Mock next-intl/server —— 和上面的客户端 mock 同源。服务端曾经返回 key 名，
// 于是 Server Component 的断言写的是 key 而不是文案：改真实文案不会变红。
vi.mock("next-intl/server", async () => {
  const { getFlatMessages, lookupMessage } =
    await import("@/test/i18n-messages");
  const messages = getFlatMessages();

  return {
    // 生产签名是 getTranslations(namespace) 或 getTranslations({ locale, namespace })。
    getTranslations: vi.fn((options?: string | { namespace?: string }) => {
      const namespace =
        typeof options === "string" ? options : options?.namespace;

      return (key: string) =>
        lookupMessage(messages, namespace ? `${namespace}.${key}` : key);
    }),
    getLocale: vi.fn(() => "en"),
    getMessages: vi.fn(() => ({})),
    getFormatter: vi.fn(() => ({
      dateTime: vi.fn(),
      number: vi.fn(),
      relativeTime: vi.fn(),
    })),
    setRequestLocale: vi.fn(),
    getRequestConfig: vi.fn(() => ({})),
    unstable_setRequestLocale: vi.fn(),
  };
});

// Mock @/i18n/routing - 提供完整的路由Mock配置
vi.mock("@/i18n/routing", () => ({
  routing: {
    locales: ["en"],
    defaultLocale: "en",
    localePrefix: "never",
    pathnames: {
      "/": "/",
      "/about": "/about",
      "/contact": "/contact",
      "/products": "/products",
      "/products/[market]": "/products/[market]",
      "/oem-wholesale": "/oem-wholesale",
      "/guides/flood-barrier-materials-guide":
        "/guides/flood-barrier-materials-guide",
      "/guides/flood-barrier-specifications":
        "/guides/flood-barrier-specifications",
      "/request-quote": "/request-quote",
      "/warranty": "/warranty",
      "/privacy": "/privacy",
      "/terms": "/terms",
    },
  },
  Link: ({ children, href, prefetch: _prefetch, ...props }: any) => {
    const resolvedHref =
      typeof href === "string"
        ? href
        : `${href.pathname}${
            href.query === undefined
              ? ""
              : `?${new URLSearchParams(href.query)}`
          }`;

    return React.createElement("a", { href: resolvedHref, ...props }, children);
  },
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => "/"),
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
}));

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({
    theme: "light",
    setTheme: vi.fn(),
    resolvedTheme: "light",
    themes: ["light", "dark", "system"],
    systemTheme: "light",
  })),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));
