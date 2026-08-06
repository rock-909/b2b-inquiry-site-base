import type { ComponentProps } from "react";

import { HeroGuideOverlay } from "@/components/grid/hero-guide-overlay";
import { ProductDiagramPanel } from "@/components/products/product-diagrams";
import { Button } from "@/components/ui/button";
import type { TucsenbergProductDiagram } from "@/constants/tucsenberg-product-page-types";
import { Link } from "@/i18n/routing";

type HeroSectionHref = ComponentProps<typeof Link>["href"];

interface HeroSectionProofItem {
  value: string;
  label?: string;
}

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
  proofAriaLabel: string;
  proofItems: HeroSectionProofItem[];
  /**
   * Working-principle drawing (Q1.5 "does this actually work?" —
   * docs/design/设计真相.md). The product-line index lives in the five cards
   * below the hero; the hero must not pre-answer it.
   */
  diagram: TucsenbergProductDiagram;
}

export interface HeroSectionViewProps {
  content: HeroSectionContent;
}

function HeroEyebrow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
      <span className="text-[13px] font-medium tracking-[0.04em] text-muted-foreground uppercase">
        {text}
      </span>
    </div>
  );
}

function HeroVisual({ diagram }: { diagram: TucsenbergProductDiagram }) {
  return (
    <div data-testid="hero-diagram" className="min-w-0">
      <ProductDiagramPanel diagram={diagram} />
    </div>
  );
}

function HeroProofPanel({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: HeroSectionProofItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label={ariaLabel}
      className="mt-6 grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/40 p-2 font-mono text-[13px] md:grid-cols-4"
    >
      {items.map((item) => (
        <li
          key={`${item.value}::${item.label ?? ""}`}
          className="min-w-0 rounded-lg bg-background/70 px-3 py-2"
        >
          <span className="block font-semibold break-words text-foreground">
            {item.value}
          </span>
          {item.label !== undefined ? (
            <span className="mt-0.5 block break-words text-muted-foreground">
              {item.label}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function HeroSectionView({ content }: HeroSectionViewProps) {
  return (
    <section
      data-testid="hero-section"
      className="relative px-6 py-10 pb-14 md:py-16 md:pb-[72px]"
    >
      <HeroGuideOverlay />
      <div className="relative z-[1] mx-auto grid max-w-[1080px] grid-cols-1 items-center gap-12 md:grid-cols-2">
        <div className="flex min-w-0 flex-col">
          <HeroEyebrow text={content.eyebrow} />

          <div>
            <h1 className="mt-4 text-[36px] leading-[1.12] font-semibold text-balance md:text-[46px] md:leading-[1.06]">
              {content.title}
            </h1>
          </div>

          <div>
            <p className="mt-4 max-w-[480px] text-lg text-pretty text-muted-foreground">
              {content.subtitle}
            </p>
          </div>

          <div>
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

          <div>
            <HeroProofPanel
              ariaLabel={content.proofAriaLabel}
              items={content.proofItems}
            />
          </div>
        </div>

        <HeroVisual diagram={content.diagram} />
      </div>
    </section>
  );
}
