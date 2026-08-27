import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { generateLocaleStaticParams } from "@/app/[locale]/generate-static-params";
import { JsonLdGraphScript } from "@/components/seo/json-ld-script";
import { EmbeddedInquiryFormSection } from "@/components/sections/inquiry-form-embed";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  OFFERINGS,
  getOfferingById,
  getOfferingPath,
  type Offering,
} from "@/config/offerings";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";
import { Link } from "@/i18n/routing";
import { resolveLocaleParam } from "@/i18n/locale-utils";
import { getSourceMessages } from "@/lib/i18n/load-messages";
import { generateMetadataForPath } from "@/lib/seo-metadata";
import {
  buildBreadcrumbListSchema,
  generateProductData,
} from "@/lib/structured-data-generators";

function ProductDetailList({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-5 grid gap-x-8 gap-y-4 text-muted-foreground sm:grid-cols-2">
      {items.map((item) => (
        <li key={item} className="border-s-2 border-primary/40 ps-4">
          {item}
        </li>
      ))}
    </ul>
  );
}

interface ProductDetailPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return generateLocaleStaticParams().flatMap(({ locale }) =>
    OFFERINGS.map((offering) => ({ locale, slug: offering.id })),
  );
}

function resolveOffering(slug: string) {
  const offering = getOfferingById(slug);
  if (!offering) notFound();
  return offering;
}

function buildProductStructuredData(offering: Offering) {
  const productUrl = new URL(
    getOfferingPath(offering.id),
    SINGLE_SITE_CONFIG.baseUrl,
  ).toString();

  return [
    generateProductData({
      name: offering.name,
      description: offering.description,
      url: productUrl,
      brand: SINGLE_SITE_CONFIG.name,
    }),
    buildBreadcrumbListSchema([
      { name: "Home", url: SINGLE_SITE_CONFIG.baseUrl },
      {
        name: "Products",
        url: new URL("/products", SINGLE_SITE_CONFIG.baseUrl).toString(),
      },
      { name: offering.name, url: productUrl },
    ]),
  ];
}

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const locale = resolveLocaleParam({ locale: localeParam });
  const offering = resolveOffering(slug);

  return generateMetadataForPath({
    locale,
    pageType: "products",
    path: getOfferingPath(offering.id),
    config: {
      title: offering.name,
      description: offering.summary,
      type: "product",
    },
  });
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { locale: localeParam, slug } = await params;
  const locale = resolveLocaleParam({ locale: localeParam });
  const offering = resolveOffering(slug);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "products" });
  const tForm = await getTranslations({ locale, namespace: "inquiry.form" });
  const messages = getSourceMessages(locale);
  return (
    <>
      <JsonLdGraphScript
        locale={locale}
        data={buildProductStructuredData(offering)}
      />
      <article className="mx-auto max-w-[880px] px-6 py-14 md:py-[72px]">
        <Link
          href="/products"
          prefetch={false}
          className="text-sm font-medium text-[var(--primary-text)] hover:underline"
        >
          {t("detail.backToProducts")}
        </Link>
        <header className="mt-8 max-w-3xl">
          <p className="text-sm font-semibold tracking-[0.12em] text-[var(--primary-text)] uppercase">
            {t("detail.factsEyebrow")}
          </p>
          <h1 className="text-heading text-balance">{offering.name}</h1>
          <p className="text-section mt-4 text-pretty text-muted-foreground">
            {offering.summary}
          </p>
          <p className="text-body mt-6 text-pretty text-muted-foreground">
            {offering.description}
          </p>
        </header>

        <div className="section-divider mt-12 space-y-12 pt-10">
          <section aria-labelledby="applications-title">
            <h2 id="applications-title" className="text-section">
              {t("detail.applicationsTitle")}
            </h2>
            <ProductDetailList items={offering.applications} />
          </section>
          <section aria-labelledby="specifications-title">
            <h2 id="specifications-title" className="text-section">
              {t("detail.specificationsTitle")}
            </h2>
            <dl className="mt-5 divide-y divide-border rounded-[var(--card-radius)] border border-border bg-card">
              {offering.specifications.map((specification) => (
                <div
                  key={specification.label}
                  className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-8"
                >
                  <dt className="font-medium text-foreground">
                    {specification.label}
                  </dt>
                  <dd className="text-muted-foreground">
                    {specification.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-labelledby="materials-title">
            <h2 id="materials-title" className="text-section">
              {t("detail.materialsTitle")}
            </h2>
            <ProductDetailList items={offering.materials} />
          </section>
          <section aria-labelledby="configuration-title">
            <h2 id="configuration-title" className="text-section">
              {t("detail.configurationTitle")}
            </h2>
            <ProductDetailList items={offering.configuration} />
          </section>
          <section aria-labelledby="delivery-title">
            <h2 id="delivery-title" className="text-section">
              {t("detail.deliveryTitle")}
            </h2>
            <ProductDetailList items={offering.delivery} />
          </section>
          <section aria-labelledby="evidence-title">
            <h2 id="evidence-title" className="text-section">
              {t("detail.evidenceTitle")}
            </h2>
            <ProductDetailList items={offering.evidence} />
          </section>
        </div>

        <a href="#inquiry" className={buttonVariants({ className: "mt-10" })}>
          {t("detail.startInquiry")}
        </a>

        <EmbeddedInquiryFormSection
          id="inquiry"
          title={t("detail.inquirySectionTitle", {
            productName: offering.name,
          })}
          initialMessage={tForm("productInterestTemplate", {
            productName: offering.name,
          })}
          messages={messages}
        />
      </article>
    </>
  );
}
