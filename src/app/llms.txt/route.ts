import { createTranslator, type Messages } from "next-intl";
import {
  PUBLIC_STATIC_PAGE_DEFINITIONS,
  type PublicStaticPageDefinition,
} from "@/config/pages.config";
import { LOCALES_CONFIG } from "@/config/paths";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";
import type { Locale } from "@/i18n/routing";
import { getStaticPage } from "@/lib/content/static-pages";
import { loadCompleteMessages } from "@/lib/i18n/load-messages";
import {
  buildCanonicalForPath,
  createStaticPageMetadataConfig,
} from "@/lib/seo-metadata";

// llmstxt.org 格式：H1 站名、引用块摘要、按语言分组的页面链接；标题与描述沿用各页 metadata 的来源。
function pageLink(page: PublicStaticPageDefinition, locale: Locale): string {
  const { title, description } =
    page.contentSlug === null
      ? {
          title: SINGLE_SITE_CONFIG.name,
          // getTranslations 依赖 root params，Route Handler 里不可用；消息会被预编译，经 translator 取值。
          description: createTranslator({
            locale,
            messages: loadCompleteMessages(locale) as Messages,
            namespace: "home.metadata",
          })("description"),
        }
      : createStaticPageMetadataConfig(
          getStaticPage(page.contentSlug, locale).metadata,
        );
  const url = buildCanonicalForPath(page.path, locale);
  return `- [${title ?? page.pageType}](${url})${description ? `: ${description}` : ""}`;
}

export function GET(): Response {
  const lines = [`# ${SINGLE_SITE_CONFIG.name}`, ""];
  if (SINGLE_SITE_CONFIG.description) {
    lines.push(`> ${SINGLE_SITE_CONFIG.description}`, "");
  }
  for (const locale of LOCALES_CONFIG.locales) {
    lines.push(`## ${LOCALES_CONFIG.displayNames[locale]}`, "");
    for (const page of PUBLIC_STATIC_PAGE_DEFINITIONS) {
      // 与 sitemap 同一索引规则：noindex 页面（如占位法务页）不列出。
      if (page.sitemap.include) lines.push(pageLink(page, locale));
    }
    lines.push("");
  }
  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
