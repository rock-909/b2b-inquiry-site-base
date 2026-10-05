import { render } from "@testing-library/react";
import { Children, isValidElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { LegalPageShell } from "@/components/content/legal-page-shell";
import { JsonLdGraphScript } from "@/components/seo/json-ld-script";
import { StaticContentPage } from "@/app/[locale]/static-content-page";

/**
 * 西语静态内容页的 JSON-LD 必须与 canonical 同属 /es 网址；
 * 走真实的 StaticContentPage → LegalPageShell → JsonLdGraphScript 链路。
 */

const ES_PAGES = [
  { pageType: "about", slug: "about", path: "/es/about" },
  { pageType: "privacy", slug: "privacy", path: "/es/privacy" },
  { pageType: "terms", slug: "terms", path: "/es/terms" },
] as const;

async function renderGraphNodes(
  config: Pick<(typeof ES_PAGES)[number], "pageType" | "slug">,
) {
  const element = await StaticContentPage({
    params: Promise.resolve({ locale: "es" }),
    config,
  });
  // 只解开 JSON-LD 这一个异步子树，不渲染正文 markdown。
  const shell = (await LegalPageShell(element.props)) as ReactElement<{
    children: ReactElement[];
  }>;
  const jsonLd = Children.toArray(shell.props.children).find(
    (child): child is ReactElement<{ locale: "es" }> =>
      isValidElement(child) && child.type === JsonLdGraphScript,
  );
  render(await JsonLdGraphScript(jsonLd!.props));

  const script = document.querySelector('script[type="application/ld+json"]');
  const graph = JSON.parse(script?.textContent ?? "{}") as {
    "@graph": Array<Record<string, unknown>>;
  };
  return graph["@graph"];
}

describe("StaticContentPage structured data (es)", () => {
  it.each(ES_PAGES)(
    "Given the es $pageType page, When it renders, Then WebPage and breadcrumb URLs carry the /es prefix",
    async ({ pageType, slug, path }) => {
      const nodes = await renderGraphNodes({ pageType, slug });
      const webPage = nodes.find((node) => node["@type"] === "WebPage");
      const breadcrumb = nodes.find(
        (node) => node["@type"] === "BreadcrumbList",
      );
      const items = breadcrumb?.itemListElement as Array<{ item: string }>;
      const pathOf = (url: unknown) => new URL(String(url)).pathname;

      expect(webPage).toMatchObject({ inLanguage: "es" });
      expect(pathOf(webPage?.["@id"])).toBe(path);
      expect(pathOf(webPage?.url)).toBe(path);
      expect(items.map((entry) => pathOf(entry.item))).toEqual(["/es", path]);
    },
  );
});
