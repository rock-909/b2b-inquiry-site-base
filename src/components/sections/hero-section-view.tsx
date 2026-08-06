import type { ComponentProps } from "react";

import { HeroGuideOverlay } from "@/components/grid/hero-guide-overlay";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";

type HeroSectionHref = ComponentProps<typeof Link>["href"];

interface HeroSectionCta {
  label: string;
  href: HeroSectionHref;
}

export interface HeroSectionContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta: HeroSectionCta;
  secondaryCta: HeroSectionCta;
}

export interface HeroSectionViewProps {
  content: HeroSectionContent;
}

export function HeroSectionView({ content }: HeroSectionViewProps) {
  return (
    <section
      data-testid="hero-section"
      className="relative px-6 py-10 pb-14 md:py-16 md:pb-[72px]"
    >
      <HeroGuideOverlay />
      <div className="relative z-[1] mx-auto max-w-[1080px]">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <span
              className="size-2 rounded-full bg-primary"
              aria-hidden="true"
            />
            <span className="text-[13px] font-medium tracking-[0.04em] text-muted-foreground uppercase">
              {content.eyebrow}
            </span>
          </div>
          <h1 className="mt-4 text-[36px] leading-[1.12] font-semibold text-balance md:text-[52px] md:leading-[1.06]">
            {content.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">
            {content.subtitle}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={content.primaryCta.href} prefetch={false}>
                {content.primaryCta.label}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={content.secondaryCta.href} prefetch={false}>
                {content.secondaryCta.label}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
