import type { Metadata } from "next";
import type { LocaleParam } from "@/app/[locale]/generate-static-params";
import { LegalPageShell } from "@/components/content/legal-page-shell";
import { getStaticPageContentSlug } from "@/config/pages.config";
import { getCanonicalPath, type PageType } from "@/config/paths";
import { resolveLocaleParam } from "@/i18n/locale-utils";
import { loadLegalPage } from "@/lib/content/legal-page";
import {
  createStaticPageMetadataConfig,
  generateMetadataForPath,
} from "@/lib/seo-metadata";

export interface StaticContentPageConfig {
  pageType: PageType;
}

export interface StaticContentPageProps {
  params: Promise<LocaleParam>;
}

export async function generateStaticContentPageMetadata(
  props: StaticContentPageProps,
  config: StaticContentPageConfig,
): Promise<Metadata> {
  const locale = resolveLocaleParam(await props.params);
  const { metadata } = await loadLegalPage(
    getStaticPageContentSlug(config.pageType),
    locale,
  );

  return generateMetadataForPath({
    locale,
    pageType: config.pageType,
    path: getCanonicalPath(config.pageType),
    config: createStaticPageMetadataConfig(metadata, { includeImage: true }),
  });
}

export async function StaticContentPage({
  config,
  params,
}: StaticContentPageProps & {
  config: StaticContentPageConfig;
}) {
  const locale = resolveLocaleParam(await params);

  const { metadata, blocks, headings } = await loadLegalPage(
    getStaticPageContentSlug(config.pageType),
    locale,
  );
  const pagePath = getCanonicalPath(config.pageType);

  return (
    <LegalPageShell
      metadata={metadata}
      blocks={blocks}
      headings={headings}
      locale={locale}
      pagePath={pagePath}
    />
  );
}
