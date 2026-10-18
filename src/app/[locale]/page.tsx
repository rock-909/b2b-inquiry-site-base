import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  generateLocaleStaticParams,
  type LocaleParam,
} from "@/app/[locale]/generate-static-params";
import { JsonLdGraphScript } from "@/components/seo/json-ld-script";
import { Link } from "@/i18n/routing";
import { getCanonicalPath } from "@/config/paths";
import { resolveLocaleParam } from "@/i18n/locale-utils";
import { generateMetadataForPath } from "@/lib/seo-metadata";

interface HomePageProps {
  params: Promise<LocaleParam>;
}

export function generateStaticParams() {
  return generateLocaleStaticParams();
}

export async function generateMetadata({
  params,
}: HomePageProps): Promise<Metadata> {
  const locale = resolveLocaleParam(await params);
  const t = await getTranslations({ locale, namespace: "home.metadata" });

  return generateMetadataForPath({
    locale,
    pageType: "home",
    path: getCanonicalPath("home"),
    config: {
      title: t("title"),
      description: t("description"),
    },
  });
}

export default async function HomePage({ params }: HomePageProps) {
  const locale = resolveLocaleParam(await params);
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <>
      <JsonLdGraphScript locale={locale} />
      <section className="mx-auto max-w-[720px] px-6 py-12 md:py-16">
        <h1 className="text-heading text-balance">{t("title")}</h1>
        <p className="text-body mt-4 text-pretty text-muted-foreground">
          {t("description")}
        </p>
        <Link
          href={getCanonicalPath("contact")}
          className="mt-6 inline-block py-2 text-[var(--primary-text)] underline underline-offset-4"
          prefetch={false}
        >
          {t("contactLink")}
        </Link>
      </section>
    </>
  );
}
