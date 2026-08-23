import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  generateLocaleStaticParams,
  type LocaleParam,
} from "@/app/[locale]/generate-static-params";
import { JsonLdGraphScript } from "@/components/seo/json-ld-script";
import { OFFERINGS, getOfferingPath } from "@/config/offerings";
import { getLocalizedPath } from "@/config/paths";
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
            url: new URL(pagePath, SINGLE_SITE_CONFIG.baseUrl).toString(),
          }),
        ]}
      />
      <div className="mx-auto max-w-[1080px] px-6 py-14 md:py-[88px]">
        <header className="grid items-end gap-8 md:grid-cols-[minmax(0,8fr)_minmax(0,3fr)]">
          <h1 className="text-heading max-w-[15em] tracking-[-0.02em] text-balance">
            {t("page.heading")}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("page.description")}
          </p>
        </header>

        {/* 工程目录行列表：整行可点击，hover 左侧指示线 + 行号变蓝 */}
        <div
          className="mt-14 border-t border-border"
          data-testid="offering-row-list"
        >
          <div
            aria-hidden="true"
            className="hidden gap-8 pb-3 font-mono text-[11px] tracking-[0.09em] text-muted-foreground uppercase md:grid md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)_auto]"
          >
            <span>{t("page.colDesignation")}</span>
            <span>{t("page.colDescription")}</span>
            <span className="sr-only">{t("page.viewDetails")}</span>
          </div>
          {OFFERINGS.map((offering, index) => (
            <Link
              key={offering.id}
              href={getOfferingPath(offering.id)}
              prefetch={false}
              className="group relative grid gap-2 border-b border-border px-1 py-7 transition-colors duration-100 hover:bg-card md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)_auto] md:items-baseline md:gap-8"
            >
              <span
                aria-hidden="true"
                className="absolute top-0 left-0 h-full w-0.5 origin-top scale-y-0 bg-primary transition-transform duration-150 group-hover:scale-y-100"
              />
              <span className="flex items-baseline gap-4">
                <span
                  aria-hidden="true"
                  className="font-mono text-xs text-muted-foreground transition-colors duration-100 group-hover:text-primary"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-[17px] font-semibold tracking-[-0.01em]">
                  {offering.name}
                </span>
              </span>
              <span className="text-sm text-pretty text-muted-foreground">
                {offering.summary}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="sr-only">{t("page.viewDetails")}</span>
                <span
                  aria-hidden="true"
                  className="transition-transform duration-100 group-hover:translate-x-0.5"
                >
                  →
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
