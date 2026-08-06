import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "@/types/content.types";

/**
 * 五个页面都是同一个形状：把一份 `{ pageType, slug, shell }` 转交给
 * `StaticMdxPage`。它们此前没有任何单测——`vitest related` 对它们报
 * "No test files found"，而 pre-commit 钩子把这一条当成通过。
 *
 * 这些页面靠复制粘贴产生，真实的失败方式就是 slug 或 pageType 抄错一个：
 * 页面照样渲染、构建照样通过，只是端出了另一篇 MDX。这里逐个钉住那份配置。
 */

const { mockStaticMdxPage, mockGenerateMetadata } = vi.hoisted(() => ({
  mockStaticMdxPage: vi.fn(() => <div data-testid="static-mdx-page" />),
  mockGenerateMetadata: vi.fn(),
}));

vi.mock("@/app/[locale]/static-mdx-page", () => ({
  StaticMdxPage: mockStaticMdxPage,
  generateStaticMdxPageMetadata: mockGenerateMetadata,
}));

vi.mock("@/app/[locale]/generate-static-params", () => ({
  generateLocaleStaticParams: () => [{ locale: "en" }],
}));

interface ShellPageModule {
  default: (props: {
    params: Promise<{ locale: Locale }>;
  }) => React.ReactElement;
  generateMetadata: (props: { params: Promise<{ locale: Locale }> }) => unknown;
  generateStaticParams: () => unknown;
}

const shellPages = [
  { name: "about", load: () => import("@/app/[locale]/about/page") },
  {
    name: "oem-wholesale",
    load: () => import("@/app/[locale]/oem-wholesale/page"),
  },
  { name: "warranty", load: () => import("@/app/[locale]/warranty/page") },
  {
    name: "flood-barrier-materials-guide",
    load: () =>
      import("@/app/[locale]/guides/flood-barrier-materials-guide/page"),
  },
  {
    name: "flood-barrier-specifications",
    load: () =>
      import("@/app/[locale]/guides/flood-barrier-specifications/page"),
  },
] as const;

describe("StaticMdxPage 转发壳", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(shellPages)(
    "$name 用自己的 slug 转交给 StaticMdxPage",
    async ({ name, load }) => {
      const module = (await load()) as unknown as ShellPageModule;
      const params = Promise.resolve({ locale: "en" as Locale });

      render(module.default({ params }));

      expect(mockStaticMdxPage).toHaveBeenCalledTimes(1);
      const [props] = mockStaticMdxPage.mock.calls[0] as unknown as [
        { config: { slug: string; pageType: string } },
      ];
      expect(props.config.slug).toBe(name);
      expect(props.config.pageType).toBeTruthy();
    },
  );

  it.each(shellPages)(
    "$name 的 metadata 走同一份配置",
    async ({ name, load }) => {
      const module = (await load()) as unknown as ShellPageModule;
      const params = Promise.resolve({ locale: "en" as Locale });

      module.generateMetadata({ params });

      expect(mockGenerateMetadata).toHaveBeenCalledTimes(1);
      const [, config] = mockGenerateMetadata.mock.calls[0] as unknown as [
        unknown,
        { slug: string },
      ];
      expect(config.slug).toBe(name);
    },
  );

  it.each(shellPages)("$name 声明了 locale 静态参数", async ({ load }) => {
    const module = (await load()) as unknown as ShellPageModule;

    expect(module.generateStaticParams()).toEqual([{ locale: "en" }]);
  });
});
