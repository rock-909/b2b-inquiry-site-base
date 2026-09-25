import { NavigationPending } from "@/components/navigation/navigation-pending";
import type { ComponentProps } from "react";

import { HeroGuideOverlay } from "@/components/grid/hero-guide-overlay";
import { buttonVariants } from "@/components/ui/button-variants";
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
      className="relative px-6 py-12 pb-16 md:py-20 md:pb-24"
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
          <h1 className="mt-5 text-[36px] leading-[1.12] font-semibold tracking-tight text-balance md:text-[52px] md:leading-[1.06]">
            {content.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">
            {content.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href={content.primaryCta.href}
              prefetch={false}
              className={buttonVariants({ className: "min-h-11 px-6" })}
            >
              {content.primaryCta.label}
              <NavigationPending />
            </Link>
            <Link
              href={content.secondaryCta.href}
              prefetch={false}
              className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground motion-reduce:transition-none"
            >
              {content.secondaryCta.label}
              <NavigationPending />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
