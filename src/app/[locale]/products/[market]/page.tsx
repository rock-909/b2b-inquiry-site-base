import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getAllMarketSlugs,
  getMarketBySlug,
} from "@/constants/product-catalog";
import {
  getProductMarketPath,
  LOCALES_CONFIG,
  SITE_CONFIG,
} from "@/config/paths";
import { generateMetadataForPath } from "@/lib/seo-metadata";
import { JsonLdGraphScript } from "@/components/seo/json-ld-script";
import { CatalogBreadcrumb } from "@/components/products/catalog-breadcrumb";
import { Link } from "@/i18n/routing";
import { resolveLocaleParam } from "@/i18n/locale-utils";
import { buildMarketPageJsonLdData } from "@/app/[locale]/products/[market]/market-jsonld";
import { Button } from "@/components/ui/button";
import {
  getTucsenbergProductPage,
  type TucsenbergProductPage,
  type TucsenbergProductProseSection,
  type TucsenbergProductSection,
  type TucsenbergProductTable,
} from "@/constants/tucsenberg-product-pages";
import type {
  TucsenbergProductDiagramKind,
  TucsenbergProductScenes,
} from "@/constants/tucsenberg-product-page-types";
import { buildTucsenbergProductFaqSchema } from "@/constants/tucsenberg-product-faq-schema";
import {
  ProductDiagramPanel,
  ProductLineGlyph,
} from "@/components/products/product-diagrams";
import { ProductRunCalculator } from "@/components/products/product-run-calculator";
import { InlineMarkdown } from "@/lib/content/inline-markdown";
import { createCatalogInquiryHref } from "@/lib/lead-pipeline/inquiry-handoff";

function getProductQuoteHref(productPage: TucsenbergProductPage) {
  return createCatalogInquiryHref(productPage.slug);
}

export function generateStaticParams() {
  const markets = getAllMarketSlugs();
  return LOCALES_CONFIG.locales.flatMap((locale) =>
    markets.map((market) => ({ locale, market })),
  );
}

interface MarketPageProps {
  params: Promise<{ locale: string; market: string }>;
}

function ProductContentTable({
  table,
  fade,
  label,
}: {
  table: TucsenbergProductTable;
  fade: "background" | "card";
  label: string;
}) {
  return (
    <div className="relative">
      <div
        aria-label={label}
        className="[scrollbar-width:thin] overflow-x-auto rounded-2xl border border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        data-scrollable-table="true"
        role="region"
        tabIndex={0}
      >
        <table className="min-w-full divide-y divide-border text-left text-sm">
          <thead className="bg-muted/60 text-foreground">
            <tr>
              {table.columns.map((column) => (
                <th key={column} className="px-4 py-3 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {table.rows.map((row) => (
              <tr key={row.join("|")}>
                {row.map((cell, index) => (
                  <td
                    key={`${cell}-${index}`}
                    className="px-4 py-3 align-top text-muted-foreground tabular-nums"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile cue that the table scrolls; wide tables clip silently otherwise. */}
      <div
        aria-hidden
        className={
          fade === "card"
            ? "pointer-events-none absolute inset-y-px right-px w-8 rounded-r-2xl bg-gradient-to-l from-card to-transparent md:hidden"
            : "pointer-events-none absolute inset-y-px right-px w-8 rounded-r-2xl bg-gradient-to-l from-background to-transparent md:hidden"
        }
      />
    </div>
  );
}

function ProductSectionBody({
  section,
}: {
  section: TucsenbergProductProseSection;
}) {
  return (
    <>
      {section.paragraphs?.map((paragraph) => (
        <p
          key={paragraph}
          className="mb-4 text-base leading-7 text-muted-foreground last:mb-0"
        >
          <InlineMarkdown text={paragraph} />
        </p>
      ))}
      {section.bullets ? (
        <ul className="space-y-3 text-base leading-7 text-muted-foreground">
          {section.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-3">
              <span
                aria-hidden
                className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary"
              />
              <span>
                <InlineMarkdown text={bullet} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {section.footer ? (
        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          <InlineMarkdown text={section.footer} />
        </p>
      ) : null}
    </>
  );
}

/**
 * Rhythm over uniformity: data tables run open and full-width, argument
 * tables (table + framing paragraphs) keep a card, narrative sections run as
 * open two-column text capped at a readable measure. Only the final CTA gets
 * the accent band — one visual focus per page.
 */
function ProductContentSection({
  section,
}: {
  section: TucsenbergProductSection;
}) {
  if ("table" in section) {
    const { table } = section;

    if (!section.paragraphs) {
      return (
        <section>
          <h2 className="text-section mb-5">{section.title}</h2>
          <ProductContentTable
            table={table}
            fade="background"
            label={section.title}
          />
          {section.footer ? (
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              <InlineMarkdown text={section.footer} />
            </p>
          ) : null}
        </section>
      );
    }

    return (
      <section className="surface-card p-6 md:p-8">
        <h2 className="text-section mb-4">{section.title}</h2>
        {section.paragraphs?.map((paragraph) => (
          <p
            key={paragraph}
            className="mb-5 max-w-[75ch] text-base leading-7 text-muted-foreground"
          >
            <InlineMarkdown text={paragraph} />
          </p>
        ))}
        <ProductContentTable table={table} fade="card" label={section.title} />
        {section.footer ? (
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            <InlineMarkdown text={section.footer} />
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <h2 className="text-section mb-4 md:mb-0">{section.title}</h2>
      <div className="max-w-[75ch] min-w-0">
        <ProductSectionBody section={section} />
      </div>
    </section>
  );
}

/** Scannable verifiable facts under the hero — never invented numbers. */
function ProductProofStrip({ items }: { items: readonly string[] }) {
  return (
    <ul className="mb-12 flex flex-wrap items-center gap-x-8 gap-y-2 border-y border-border py-3 font-mono text-[11.5px] text-muted-foreground md:mb-16">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * "Can I use it on my site?" answered by showing: real photos when delivered,
 * honest schematic bases until then (docs/design/设计真相.md).
 */
function ProductSceneWall({
  scenes,
  glyphKind,
}: {
  scenes: TucsenbergProductScenes;
  glyphKind: TucsenbergProductDiagramKind | undefined;
}) {
  return (
    <section>
      <h2 className="text-section mb-3">{scenes.title}</h2>
      {scenes.intro ? (
        <p className="mb-6 max-w-[75ch] text-sm leading-6 text-muted-foreground">
          {scenes.intro}
        </p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {scenes.items.map((scene) => (
          <li
            key={scene.title}
            className="overflow-hidden rounded-xl border border-border"
          >
            <div className="relative aspect-[4/3] bg-muted/40">
              {scene.image ? (
                <Image
                  src={scene.image.src}
                  alt={scene.image.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover"
                />
              ) : (
                <div
                  aria-hidden
                  className="flex h-full items-center justify-center text-muted-foreground/50"
                >
                  {glyphKind ? (
                    <ProductLineGlyph kind={glyphKind} className="size-14" />
                  ) : null}
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="text-sm font-semibold">{scene.title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {scene.note}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {scenes.boundary ? (
        <p
          data-testid="scene-wall-boundary"
          className="mt-6 max-w-3xl rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6 text-foreground"
        >
          <InlineMarkdown text={scenes.boundary} />
        </p>
      ) : null}
    </section>
  );
}

interface ProductLandingLabels {
  faqTitle: string;
  finalCtaTitle: string;
  rfqNoteFallback: string;
  downloadSpec: string;
}

function ProductFaqSection({
  page,
  labels,
}: {
  page: TucsenbergProductPage;
  labels: ProductLandingLabels;
}) {
  return (
    <section className="md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <h2 className="text-section mb-4 md:mb-0">{labels.faqTitle}</h2>
      <div className="max-w-[75ch] min-w-0 divide-y divide-border">
        {page.faqs.map((faq) => (
          <article key={faq.question} className="py-5 first:pt-0 last:pb-0">
            <h3 className="text-lg font-semibold">{faq.question}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              <InlineMarkdown text={faq.answer} />
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductFinalCta({
  page,
  labels,
}: {
  page: TucsenbergProductPage;
  labels: ProductLandingLabels;
}) {
  return (
    <section className="rounded-2xl bg-accent px-6 py-10 md:px-10 md:py-12">
      <h2 className="text-section">{labels.finalCtaTitle}</h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
        {page.rfqNote ?? labels.rfqNoteFallback}
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button asChild size="lg">
          <Link href={getProductQuoteHref(page)}>{page.cta.label}</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <a href={page.downloadHref}>{labels.downloadSpec}</a>
        </Button>
      </div>
      {page.cta.note ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {page.cta.note}
        </p>
      ) : null}
    </section>
  );
}

export async function generateMetadata({
  params,
}: MarketPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const { market: marketSlug } = resolvedParams;
  const locale = resolveLocaleParam(resolvedParams);
  const market = getMarketBySlug(marketSlug);
  const productPage = getTucsenbergProductPage(marketSlug);

  if (!market || !productPage) return {};

  const { updatedAt, ...meta } = productPage.meta;

  return generateMetadataForPath({
    locale,
    pageType: "products",
    path: getProductMarketPath(market.slug),
    config: { ...meta, modifiedTime: updatedAt },
  });
}

export default async function MarketPage({ params }: MarketPageProps) {
  const resolvedParams = await params;
  const { market: marketSlug } = resolvedParams;
  const locale = resolveLocaleParam(resolvedParams);
  setRequestLocale(locale);

  const market = getMarketBySlug(marketSlug);
  if (!market) {
    notFound();
  }

  const productPage = getTucsenbergProductPage(marketSlug);

  if (!productPage) {
    notFound();
  }

  const tLanding = await getTranslations("catalog.market.landing");
  const landingLabels: ProductLandingLabels = {
    faqTitle: tLanding("faqTitle"),
    finalCtaTitle: tLanding("finalCtaTitle"),
    rfqNoteFallback: tLanding("rfqNoteFallback"),
    downloadSpec: tLanding("downloadSpec"),
  };

  const marketUrl = new URL(
    getProductMarketPath(market.slug),
    SITE_CONFIG.baseUrl,
  ).toString();
  const faqSchema = buildTucsenbergProductFaqSchema(productPage, locale);
  const jsonLdData = await buildMarketPageJsonLdData({
    market,
    marketUrl,
    productPage,
  });

  return (
    <div
      className="mx-auto max-w-[1080px] px-6 py-8 md:py-12"
      data-testid="market-page-content"
    >
      <CatalogBreadcrumb
        homePrefetch={false}
        market={market}
        marketLabel={productPage.title}
        productsPrefetch={false}
        renderJsonLd={false}
      />

      <JsonLdGraphScript locale={locale} data={[...jsonLdData, faqSchema]} />

      <header className="mb-10 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <div className="min-w-0">
          <span className="mb-2 inline-block rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {productPage.eyebrow}
          </span>
          <h1 className="text-heading mb-4">{productPage.title}</h1>
          <p className="text-body max-w-3xl font-medium text-foreground">
            {productPage.subtitle}
          </p>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
            {productPage.lead}
          </p>
          {productPage.leadNote ? (
            <p className="mt-4 max-w-3xl rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6 text-foreground">
              <InlineMarkdown text={productPage.leadNote} />
            </p>
          ) : null}
          <div className="mt-6">
            <Button asChild>
              <Link href={getProductQuoteHref(productPage)}>
                {productPage.cta.label}
              </Link>
            </Button>
            {productPage.cta.note ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {productPage.cta.note}
              </p>
            ) : null}
          </div>
        </div>
        {productPage.diagram ? (
          <ProductDiagramPanel diagram={productPage.diagram} />
        ) : null}
      </header>

      {productPage.proofStrip ? (
        <ProductProofStrip items={productPage.proofStrip} />
      ) : null}

      <div className="space-y-12 md:space-y-16">
        {/* Q2 before Q3: "does it fit my site?" precedes "how does it work". */}
        {productPage.scenes ? (
          <ProductSceneWall
            scenes={productPage.scenes}
            glyphKind={productPage.diagram?.kind}
          />
        ) : null}
        {productPage.sections.map((section) => (
          <ProductContentSection key={section.title} section={section} />
        ))}
        {productPage.calculator ? (
          <ProductRunCalculator calculator={productPage.calculator} />
        ) : null}
        <ProductFaqSection page={productPage} labels={landingLabels} />
        <ProductFinalCta page={productPage} labels={landingLabels} />
      </div>
    </div>
  );
}
