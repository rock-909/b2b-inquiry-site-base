import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  generateLocaleStaticParams,
  type LocaleParam,
} from "@/app/[locale]/generate-static-params";
import { JsonLdGraphScript } from "@/components/seo/json-ld-script";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OFFERINGS, getOfferingPath } from "@/config/offerings";
import { getLocalizedPath, SITE_CONFIG } from "@/config/paths";
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
    path: getLocalizedPath("products", locale),
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
  const pagePath = getLocalizedPath("products", locale);

  return (
    <>
      <JsonLdGraphScript
        locale={locale}
        data={[
          buildWebPageSchema({
            locale,
            name: tMetadata("title"),
            description: tMetadata("description"),
            url: new URL(pagePath, SITE_CONFIG.baseUrl).toString(),
          }),
        ]}
      />
      <div className="mx-auto max-w-[1080px] px-6 py-14 md:py-[72px]">
        <header className="max-w-2xl">
          <p className="text-sm font-semibold tracking-[0.12em] text-primary uppercase">
            {t("page.eyebrow")}
          </p>
          <h1 className="text-heading mt-3 text-balance">
            {t("page.heading")}
          </h1>
          <p className="text-body mt-4 text-pretty text-muted-foreground">
            {t("page.description")}
          </p>
        </header>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {OFFERINGS.map((offering) => (
            <Card key={offering.id} className="flex flex-col p-6">
              <h2 className="text-section">{offering.name}</h2>
              <p className="mt-3 flex-1 text-pretty text-muted-foreground">
                {offering.summary}
              </p>
              <Button asChild className="mt-6 self-start">
                <Link href={getOfferingPath(offering.id)} prefetch={false}>
                  {t("page.viewDetails")}
                </Link>
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
