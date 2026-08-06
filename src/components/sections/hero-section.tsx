import { getTranslations } from "next-intl/server";

import {
  HeroSectionView,
  type HeroSectionContent,
} from "@/components/sections/hero-section-view";
import { ABS_FLOOD_BARRIERS_PRODUCT_PAGE } from "@/constants/tucsenberg-product-page-abs-flood-barriers";
import { SINGLE_SITE_HOME_HERO_PROOF_ITEMS } from "@/config/single-site-page-expression";
import { SINGLE_SITE_FACTS } from "@/config/single-site";
import { SINGLE_SITE_HOME_LINK_TARGETS } from "@/config/single-site-links";

export async function HeroSection() {
  const t = await getTranslations("home");
  const proofItems = SINGLE_SITE_HOME_HERO_PROOF_ITEMS.map((key) => ({
    value: t(`hero.proof.${key}`),
    label: t(`hero.proof.${key}Label`),
  }));

  const boxwallDiagram = ABS_FLOOD_BARRIERS_PRODUCT_PAGE.diagram;
  if (!boxwallDiagram || boxwallDiagram.kind !== "boxwall") {
    throw new Error("Hero boxwall diagram is missing from product constants");
  }

  const content = {
    eyebrow: t("hero.eyebrow", {
      established: SINGLE_SITE_FACTS.company.established,
    }),
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
    proofAriaLabel: t("hero.proofAriaLabel"),
    proofItems,
    diagram: {
      kind: "boxwall",
      labels: boxwallDiagram.labels,
      panelLabel: t("hero.diagram.panelLabel"),
      ariaLabel: t("hero.diagram.ariaLabel"),
      caption: t("hero.diagram.caption"),
    },
  } satisfies HeroSectionContent;

  return <HeroSectionView content={content} />;
}
