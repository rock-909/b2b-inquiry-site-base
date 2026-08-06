import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  generateLocaleStaticParams,
  type LocaleParam,
} from "@/app/[locale]/generate-static-params";
import { JsonLdGraphScript } from "@/components/seo/json-ld-script";
import { HeroSection } from "@/components/sections/hero-section";
import { Button } from "@/components/ui/button";
import { getLocalizedPath } from "@/config/paths";
import { SINGLE_SITE_HOME_LINK_TARGETS } from "@/config/single-site-links";
import { Link } from "@/i18n/routing";
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
  return generateMetadataForPath({
    locale,
    pageType: "home",
    path: getLocalizedPath("home", locale),
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
      <section className="section-divider px-6 py-14 md:py-[72px]">
        <div className="mx-auto flex max-w-[720px] flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-section text-balance">{t("finalCta.title")}</h2>
            <p className="mt-3 text-pretty text-muted-foreground">
              {t("finalCta.description")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link
                href={SINGLE_SITE_HOME_LINK_TARGETS.primaryCta}
                prefetch={false}
              >
                {t("finalCta.primary")}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link
                href={SINGLE_SITE_HOME_LINK_TARGETS.secondaryCta}
                prefetch={false}
              >
                {t("finalCta.secondary")}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
