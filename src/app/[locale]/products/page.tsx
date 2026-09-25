import { NavigationPending } from "@/components/navigation/navigation-pending";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  generateLocaleStaticParams,
  type LocaleParam,
} from "@/app/[locale]/generate-static-params";
import { JsonLdGraphScript } from "@/components/seo/json-ld-script";
import { buttonVariants } from "@/components/ui/button-variants";
import { getOfferingsForLocale, getOfferingPath } from "@/config/offerings";
import { getCanonicalPath, getLocalePath } from "@/config/paths";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";
import { Link } from "@/i18n/routing";
import { resolveLocaleParam } from "@/i18n/locale-utils";
import { generateMetadataForPath } from "@/lib/seo-metadata";
import { buildWebPageSchema } from "@/lib/structured-data-generators";

interface ProductsPageProps {
  params: Promise<LocaleParam>;
}

export function generateStaticParams() {
  return generateLocaleStaticParams();
}

export async function generateMetadata({
  params,
}: ProductsPageProps): Promise<Metadata> {
  const locale = resolveLocaleParam(await params);
  const t = await getTranslations({ locale, namespace: "products.metadata" });

  return generateMetadataForPath({
    locale,
    pageType: "products",
    path: getCanonicalPath("products"),
    config: {
      title: t("title"),
      description: t("description"),
    },
  });
}

export default async function ProductsPage({ params }: ProductsPageProps) {
  const locale = resolveLocaleParam(await params);
  setRequestLocale(locale);
  const [t, tMetadata] = await Promise.all([
    getTranslations({ locale, namespace: "products" }),
    getTranslations({ locale, namespace: "products.metadata" }),
  ]);
  const offerings = getOfferingsForLocale(locale);
  const pagePath = getCanonicalPath("products");

  return (
    <>
      <JsonLdGraphScript
        locale={locale}
        data={[
          buildWebPageSchema({
            locale,
            name: tMetadata("title"),
            description: tMetadata("description"),
            url: new URL(
              getLocalePath(locale, pagePath),
              SINGLE_SITE_CONFIG.baseUrl,
            ).toString(),
          }),
        ]}
      />
      <div className="mx-auto max-w-[1080px] px-6 py-14 md:py-[72px]">
        <header className="max-w-2xl">
          <p className="text-sm font-semibold tracking-[0.12em] text-[var(--primary-text)] uppercase">
            {t("page.eyebrow")}
          </p>
          <h1 className="text-heading mt-3 text-balance">
            {t("page.heading")}
          </h1>
          <p className="text-body mt-4 text-pretty text-muted-foreground">
            {t("page.description")}
          </p>
        </header>

        <div className="mt-10 border-t border-border">
          {offerings.map((offering) => (
            <article
              key={offering.id}
              className="grid gap-4 border-b border-border py-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-center md:gap-8"
            >
              <h2 className="text-xl font-semibold tracking-tight">
                {offering.name}
              </h2>
              <p className="text-pretty text-muted-foreground">
                {offering.summary}
              </p>
              <Link
                href={getOfferingPath(offering.id)}
                prefetch={false}
                className={buttonVariants({
                  variant: "outline",
                  className: "min-h-11 justify-self-start",
                })}
              >
                {t("page.viewDetails")}
                <NavigationPending />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
