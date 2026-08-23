import { getTranslations } from "next-intl/server";

import {
  HeroSectionView,
  type HeroSectionContent,
} from "@/components/sections/hero-section-view";
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import { SINGLE_SITE_HOME_LINK_TARGETS } from "@/config/single-site-links";

export async function HeroSection() {
  const t = await getTranslations("home");
  const languages = LOCALES_CONFIG.locales
    .map((locale) => LOCALES_CONFIG.triggerLabels[locale])
    .join(" / ");

  const content: HeroSectionContent = {
    title: t("hero.title"),
    subtitle: t("hero.subtitle"),
    primaryCta: {
      label: t("hero.cta.primary"),
      href: SINGLE_SITE_HOME_LINK_TARGETS.primaryCta,
    },
    secondaryCta: {
      label: t("hero.cta.secondary"),
      href: SINGLE_SITE_HOME_LINK_TARGETS.secondaryCta,
    },
    ctaNote: t("hero.ctaNote"),
    factSheetLabel: t("hero.factSheet.label"),
    factSheetRevision: t("hero.factSheet.revision"),
    facts: [
      {
        term: t("hero.factSheet.responseTarget.term"),
        value: t("hero.factSheet.responseTarget.pendingValue"),
        pending: true,
      },
      { term: t("hero.factSheet.languages.term"), value: languages },
      {
        term: t("hero.factSheet.workflow.term"),
        value: t("hero.factSheet.workflow.value"),
      },
      {
        term: t("hero.factSheet.contactOwner.term"),
        value: t("hero.factSheet.contactOwner.pendingValue"),
        pending: true,
      },
    ],
  };

  return <HeroSectionView content={content} />;
}
