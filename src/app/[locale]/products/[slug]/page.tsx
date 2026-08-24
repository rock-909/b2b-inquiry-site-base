import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { generateLocaleStaticParams } from "@/app/[locale]/generate-static-params";
import { JsonLdGraphScript } from "@/components/seo/json-ld-script";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  OFFERINGS,
  getOfferingById,
  getOfferingPath,
} from "@/config/offerings";
import { SINGLE_SITE_HOME_LINK_TARGETS } from "@/config/single-site-links";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";
import { Link } from "@/i18n/routing";
import { resolveLocaleParam } from "@/i18n/locale-utils";
import { generateMetadataForPath } from "@/lib/seo-metadata";
import {
  buildBreadcrumbListSchema,
  generateProductData,
} from "@/lib/structured-data-generators";

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
  const productPath = getOfferingPath(offering.id);
  const productUrl = new URL(
    productPath,
    SINGLE_SITE_CONFIG.baseUrl,
  ).toString();
  const productsUrl = new URL(
    "/products",
    SINGLE_SITE_CONFIG.baseUrl,
  ).toString();

  return (
    <>
      <JsonLdGraphScript
        locale={locale}
        data={[
          generateProductData({
            name: offering.name,
            description: offering.description,
            url: productUrl,
            brand: SINGLE_SITE_CONFIG.name,
          }),
          buildBreadcrumbListSchema([
            { name: "Home", url: SINGLE_SITE_CONFIG.baseUrl },
            { name: "Products", url: productsUrl },
            { name: offering.name, url: productUrl },
          ]),
        ]}
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
          <h1 className="text-heading text-balance">{offering.name}</h1>
          <p className="text-section mt-4 text-pretty text-muted-foreground">
            {offering.summary}
          </p>
          <p className="text-body mt-6 text-pretty text-muted-foreground">
            {offering.description}
          </p>
        </header>

        <section className="section-divider mt-12 pt-10">
          <h2 className="text-section">{t("detail.highlightsTitle")}</h2>
          <ul className="mt-5 grid gap-3 text-muted-foreground sm:grid-cols-2">
            {offering.highlights.map((highlight) => (
              <li key={highlight} className="surface-card p-4">
                {highlight}
              </li>
            ))}
          </ul>
        </section>

        <Link
          href={SINGLE_SITE_HOME_LINK_TARGETS.contact}
          prefetch={false}
          className={buttonVariants({ className: "mt-10" })}
        >
          {t("detail.requestQuote")}
        </Link>
      </article>
    </>
  );
}
