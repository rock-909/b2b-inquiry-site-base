import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { LocaleParam } from "@/app/[locale]/generate-static-params";
import { LegalPageShell } from "@/components/content/legal-page-shell";
import { getLocalizedPath, type PageType } from "@/config/paths";
import { resolveLocaleParam } from "@/i18n/locale-utils";
import { loadLegalPage } from "@/lib/content/legal-page";
import {
  createStaticPageMetadataConfig,
  generateMetadataForPath,
} from "@/lib/seo-metadata";

export interface StaticContentPageConfig {
  pageType: PageType;
  slug: string;
  /** Structured-data type for the page body; defaults to WebPage. */
  schemaType?: "WebPage" | "Article";
}

export interface StaticContentPageProps {
  params: Promise<LocaleParam>;
}

export async function generateStaticContentPageMetadata(
  props: StaticContentPageProps,
  config: StaticContentPageConfig,
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

export async function StaticContentPage({
  config,
  params,
}: StaticContentPageProps & {
  config: StaticContentPageConfig;
}) {
  const locale = resolveLocaleParam(await params);
  setRequestLocale(locale);

  const { metadata, blocks, headings } = await loadLegalPage(
    config.slug,
    locale,
  );
  const pagePath = getLocalizedPath(config.pageType, locale);

  return (
    <LegalPageShell
      metadata={metadata}
      blocks={blocks}
      headings={headings}
      locale={locale}
      schemaType={config.schemaType ?? "WebPage"}
      pagePath={pagePath}
    />
  );
}
