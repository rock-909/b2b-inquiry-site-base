import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  generateLocaleStaticParams,
  type LocaleParam,
} from "@/app/[locale]/generate-static-params";
import { JsonLdGraphScript } from "@/components/seo/json-ld-script";
import { HeroSection } from "@/components/sections/hero-section";
import { EmbeddedInquiryFormSection } from "@/components/sections/inquiry-form-embed";
import { getCanonicalPath } from "@/config/paths";
import { resolveLocaleParam } from "@/i18n/locale-utils";
import { getSourceMessages } from "@/lib/i18n/load-messages";
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
  return generateMetadataForPath({
    locale,
    pageType: "home",
    path: getCanonicalPath("home"),
  });
}

export default async function HomePage({ params }: HomePageProps) {
  const locale = resolveLocaleParam(await params);
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <>
      <JsonLdGraphScript locale={locale} />
      <HeroSection />
      <section className="section-divider px-6 py-14 md:py-[72px]">
        <div className="mx-auto max-w-[720px]">
          <h2 className="text-section text-balance">{t("value.title")}</h2>
          <p className="mt-3 text-pretty text-muted-foreground">
            {t("value.description")}
          </p>
        </div>
      </section>
      <EmbeddedInquiryFormSection
        title={t("finalCta.title")}
        description={t("finalCta.description")}
        messages={getSourceMessages(locale)}
      />
    </>
  );
}
