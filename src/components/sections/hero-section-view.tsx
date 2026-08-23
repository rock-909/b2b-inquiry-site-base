import type { ComponentProps } from "react";

import { HeroGuideOverlay } from "@/components/grid/hero-guide-overlay";
import { buttonVariants } from "@/components/ui/button-variants";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type HeroSectionHref = ComponentProps<typeof Link>["href"];

interface HeroSectionCta {
  label: string;
  href: HeroSectionHref;
}

export interface HeroFactRow {
  term: string;
  value: string;
  pending?: boolean;
}

export interface HeroSectionContent {
  title: string;
  subtitle: string;
  primaryCta: HeroSectionCta;
  secondaryCta: HeroSectionCta;
  ctaNote: string;
  factSheetLabel: string;
  factSheetRevision: string;
  facts: HeroFactRow[];
}

export interface HeroSectionViewProps {
  content: HeroSectionContent;
}

/**
 * 图纸标题栏角部对位标记（十字线）。
 */
function CornerMark({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("pointer-events-none absolute size-3.5", className)}
    >
      <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-muted-foreground/70" />
      <span className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-muted-foreground/70" />
    </span>
  );
}

export function HeroSectionView({ content }: HeroSectionViewProps) {
  return (
    <section
      data-testid="hero-section"
      className="relative px-6 py-10 pb-16 md:py-16 md:pb-24"
    >
      <HeroGuideOverlay />
      <div className="relative z-[1] mx-auto grid max-w-[1080px] gap-14 md:mt-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
        <div>
          <h1 className="text-[36px] leading-[1.08] font-semibold tracking-[-0.02em] text-balance md:text-[52px] md:leading-[1.06]">
            {content.title}
          </h1>
          <p className="mt-5 max-w-xl text-base text-pretty text-muted-foreground md:text-[17px]">
            {content.subtitle}
          </p>
          {/* 首屏行动区：单一决策 + 焦虑消除。
              依据承诺阶梯 —— Hero 处于旅程认知/兴趣阶段，只做一次
              低门槛索取；邮箱等高价索取留给后续表单步骤。 */}
          <div className="mt-9 flex flex-col items-start gap-3.5">
            <Link
              href={content.primaryCta.href}
              prefetch={false}
              className={buttonVariants({ className: "h-11 gap-2 px-6" })}
            >
              {content.primaryCta.label}
              <span aria-hidden="true">→</span>
            </Link>
            <p className="font-mono text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
              {content.ctaNote}
            </p>
            <Link
              href={content.secondaryCta.href}
              prefetch={false}
              className="border-b border-border pb-0.5 text-sm text-muted-foreground transition-colors duration-100 hover:border-muted-foreground hover:text-foreground"
            >
              {content.secondaryCta.label}
            </Link>
          </div>
        </div>

        {/* 图纸标题栏：模板事实面板，未确认值以「—」诚实占位 */}
        <aside
          aria-label={content.factSheetLabel}
          data-testid="hero-fact-sheet"
          className="relative w-full self-start border border-border bg-background lg:mt-2"
        >
          <CornerMark className="-top-2 -left-2" />
          <CornerMark className="-right-2 -bottom-2" />
          <div className="flex items-center justify-between border-b border-border bg-card px-5 py-2.5">
            <span className="font-mono text-[11px] tracking-[0.09em] text-muted-foreground uppercase">
              {content.factSheetLabel}
            </span>
            <span className="font-mono text-[11px] tracking-[0.09em]">
              {content.factSheetRevision}
            </span>
          </div>
          <dl>
            {content.facts.map((fact) => (
              <div
                key={fact.term}
                className="relative flex items-baseline justify-between gap-4 border-b border-border px-5 py-3.5 last:border-b-0"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 left-0 h-px w-2 -translate-y-1/2 bg-border"
                />
                <dt className="text-sm text-muted-foreground">{fact.term}</dt>
                <dd
                  className={cn(
                    "font-mono text-[13px] tabular-nums",
                    fact.pending ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </section>
  );
}
