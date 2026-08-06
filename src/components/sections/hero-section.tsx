import { getTranslations } from "next-intl/server";

import {
  HeroSectionView,
  type HeroSectionContent,
} from "@/components/sections/hero-section-view";
import { SINGLE_SITE_HOME_LINK_TARGETS } from "@/config/single-site-links";

export async function HeroSection() {
  const t = await getTranslations("home");
  const content: HeroSectionContent = {
    eyebrow: t("hero.eyebrow"),
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
  };

  return <HeroSectionView content={content} />;
}
