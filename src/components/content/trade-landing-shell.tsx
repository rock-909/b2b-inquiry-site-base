import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { JsonLdGraphScript } from "@/components/seo/json-ld-script";
import { LegalContentRenderer } from "@/components/content/legal-content-renderer";
import { buildShellPageSchema } from "@/components/content/legal-page-shell";
import { Button } from "@/components/ui/button";
import {
  extractFaqFromMetadata,
  generateFaqSchemaFromItems,
} from "@/lib/content/mdx-faq";
import { InlineMarkdown } from "@/lib/content/inline-markdown";
import { buildBreadcrumbListSchema } from "@/lib/structured-data-generators";
import { SITE_CONFIG } from "@/config/paths";
import { FactoryPoolDiagram } from "@/components/products/factory-pool-diagram";
import { Link } from "@/i18n/routing";
import type { LegalPageMetadata, Locale } from "@/types/content.types";

interface TradeLandingShellProps {
  metadata: LegalPageMetadata;
  content: string;
  locale: Locale;
  /** Site-relative path (e.g. "/oem-wholesale"); enables BreadcrumbList output. */
  pagePath: string;
}

/**
 * Wide conversion-register shell for trade landing pages (OEM / wholesale).
 * Same MDX source pipeline as LegalPageShell, without the legal-document
 * chrome (effective dates, table-of-contents sidebar, 720px measure).
 */
export async function TradeLandingShell({
  metadata,
  content,
  locale,
  pagePath,
}: TradeLandingShellProps): Promise<ReactNode> {
  const [t, tNav, tFaq] = await Promise.all([
    getTranslations({ locale, namespace: "oemLanding" }),
    getTranslations({ locale, namespace: "navigation" }),
    getTranslations({ locale, namespace: "faq" }),
  ]);
  const diagramLabels = {
    extrusion: t("diagramLabels.extrusion"),
    moulding: t("diagramLabels.moulding"),
    welding: t("diagramLabels.welding"),
    sewing: t("diagramLabels.sewing"),
    specAndQc: t("diagramLabels.specAndQc"),
    mixedContainer: t("diagramLabels.mixedContainer"),
  };

  const pageUrl = new URL(pagePath, SITE_CONFIG.baseUrl).toString();
  const schema = await buildShellPageSchema({
    metadata,
    locale,
    schemaType: "WebPage",
    pageUrl,
  });

  const faqItems = extractFaqFromMetadata(metadata);
  const schemas: Array<Record<string, unknown>> = [schema];
  if (faqItems.length > 0) {
    schemas.push(
      generateFaqSchemaFromItems(faqItems, locale) as unknown as Record<
        string,
        unknown
      >,
    );
  }
  schemas.push(
    buildBreadcrumbListSchema([
      { name: tNav("home"), url: new URL("/", SITE_CONFIG.baseUrl).toString() },
      { name: metadata.title, url: pageUrl },
    ]),
  );

  return (
    <>
      <JsonLdGraphScript locale={locale} data={schemas} />

      <div className="mx-auto max-w-[1080px] px-6 py-14 md:py-[72px]">
        <header className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
          <div className="min-w-0">
            <h1 className="text-heading mb-4 text-balance">
              {metadata.title}
            </h1>
            {metadata.description && (
              <p className="text-body text-muted-foreground text-pretty">
                {metadata.description}
              </p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/request-quote">{t("primaryCta")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/products">{t("secondaryCta")}</Link>
              </Button>
            </div>
          </div>
          <figure className="border-border bg-card min-w-0 rounded-2xl border p-4 md:p-5">
            <div className="border-border mb-3 flex items-center justify-between gap-3 border-b pb-3">
              <span className="text-muted-foreground font-mono text-[10px] font-semibold tracking-[0.1em] uppercase">
                {t("diagramLabel")}
              </span>
              <span aria-hidden className="bg-primary size-1.5 rounded-full" />
            </div>
            <FactoryPoolDiagram ariaLabel={t("diagramAriaLabel")} labels={diagramLabels} />
            <figcaption className="text-muted-foreground border-border mt-3 border-t pt-3 text-xs leading-5">
              {t("diagramCaption")}
            </figcaption>
          </figure>
        </header>

        <article className="mt-12 max-w-[860px] min-w-0 md:mt-16">
          <LegalContentRenderer content={content} />
        </article>

        {faqItems.length > 0 ? (
          <section
            className="mt-16 md:mt-20 md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-10"
            data-testid="faq-section"
          >
            <h2 className="text-section mb-4 md:mb-0">{tFaq("sectionTitle")}</h2>
            <div className="max-w-[75ch] min-w-0 divide-y divide-border">
              {faqItems.map((faq) => (
                <article key={faq.id} className="py-5 first:pt-0 last:pb-0">
                  <h3 className="text-lg font-semibold">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    <InlineMarkdown text={faq.answer} />
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
