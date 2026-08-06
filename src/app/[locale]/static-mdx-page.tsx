import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { LocaleParam } from "@/app/[locale]/generate-static-params";
import { LegalPageShell } from "@/components/content/legal-page-shell";
import { TradeLandingShell } from "@/components/content/trade-landing-shell";
import { getLocalizedPath, type PageType } from "@/config/paths";
import { resolveLocaleParam } from "@/i18n/locale-utils";
import { loadLegalPage } from "@/lib/content/legal-page";
import {
  createStaticPageMetadataConfig,
  generateMetadataForPath,
} from "@/lib/seo-metadata";

export interface StaticMdxPageConfig {
  pageType: PageType;
  slug: string;
  /** Structured-data type for the page body; defaults to WebPage. */
  schemaType?: "WebPage" | "Article";
  /** Rendering register: legal-document chrome (default) or wide trade landing. */
  shell?: "legal" | "landing";
}

export interface StaticMdxPageProps {
  params: Promise<LocaleParam>;
}

export async function generateStaticMdxPageMetadata(
  props: StaticMdxPageProps,
  config: StaticMdxPageConfig,
): Promise<Metadata> {
  const locale = resolveLocaleParam(await props.params);
  const { metadata } = await loadLegalPage(config.slug, locale);

  return generateMetadataForPath({
    locale,
    pageType: config.pageType,
    path: getLocalizedPath(config.pageType, locale),
    config: createStaticPageMetadataConfig(metadata, {
      includeEmptyDescription: true,
      includeImage: true,
    }),
  });
}

export async function StaticMdxPage({
  config,
  params,
}: StaticMdxPageProps & {
  config: StaticMdxPageConfig;
}) {
  const locale = resolveLocaleParam(await params);
  setRequestLocale(locale);

  const { metadata, content, headings } = await loadLegalPage(
    config.slug,
    locale,
  );
  const pagePath = getLocalizedPath(config.pageType, locale);

  if (config.shell === "landing") {
    return (
      <TradeLandingShell
        metadata={metadata}
        content={content}
        locale={locale}
        pagePath={pagePath}
      />
    );
  }

  return (
    <LegalPageShell
      metadata={metadata}
      content={content}
      headings={headings}
      locale={locale}
      schemaType={config.schemaType ?? "WebPage"}
      pagePath={pagePath}
    />
  );
}
