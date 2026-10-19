import { render } from "@testing-library/react";
import { Children, isValidElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { LegalPageShell } from "@/components/content/legal-page-shell";
import { JsonLdGraphScript } from "@/components/seo/json-ld-script";
import { StaticContentPage } from "@/app/[locale]/static-content-page";
import { LOCALES_CONFIG } from "@/config/paths";
import type { Locale } from "@/types/content.types";

/**
 * 非默认语言静态内容页的 JSON-LD 必须与 canonical 同属带语言前缀的网址；
 * 走真实的 StaticContentPage → LegalPageShell → JsonLdGraphScript 链路。
 */

const PREFIXED_PAGES = LOCALES_CONFIG.locales
  .filter((locale) => locale !== LOCALES_CONFIG.defaultLocale)
  .flatMap((locale) =>
    (["privacy", "terms"] as const).map((pageType) => ({
      locale,
      pageType,
      path: `/${locale}/${pageType}`,
    })),
  );

async function renderGraphNodes(
  locale: Locale,
  config: Pick<(typeof PREFIXED_PAGES)[number], "pageType">,
) {
  const element = await StaticContentPage({
    params: Promise.resolve({ locale }),
    config,
  });
  // 只解开 JSON-LD 这一个异步子树，不渲染正文 markdown。
  const shell = (await LegalPageShell(element.props)) as ReactElement<{
    children: ReactElement[];
  }>;
  const jsonLd = Children.toArray(shell.props.children).find(
    (child): child is ReactElement<{ locale: Locale }> =>
      isValidElement(child) && child.type === JsonLdGraphScript,
  );
  render(await JsonLdGraphScript(jsonLd!.props));

  const script = document.querySelector('script[type="application/ld+json"]');
  const graph = JSON.parse(script?.textContent ?? "{}") as {
    "@graph": Array<Record<string, unknown>>;
  };
  return graph["@graph"];
}

// 单语言站点没有带前缀的页面，此组用例自然跳过。
describe.skipIf(PREFIXED_PAGES.length === 0)(
  "StaticContentPage structured data (non-default locales)",
  () => {
    it.each(PREFIXED_PAGES)(
      "Given the $locale $pageType page, When it renders, Then WebPage and breadcrumb URLs carry the locale prefix",
      async ({ locale, pageType, path }) => {
        const nodes = await renderGraphNodes(locale, { pageType });
        const webPage = nodes.find((node) => node["@type"] === "WebPage");
        const breadcrumb = nodes.find(
          (node) => node["@type"] === "BreadcrumbList",
        );
        const items = breadcrumb?.itemListElement as Array<{ item: string }>;
        const pathOf = (url: unknown) => new URL(String(url)).pathname;

        expect(webPage).toMatchObject({ inLanguage: locale });
        expect(pathOf(webPage?.["@id"])).toBe(path);
        expect(pathOf(webPage?.url)).toBe(path);
        expect(items.map((entry) => pathOf(entry.item))).toEqual([
          `/${locale}`,
          path,
        ]);
      },
    );
  },
);
