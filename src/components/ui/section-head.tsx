import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeadProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Reusable section header using the site-wide `.text-section` H2 step
 * (24px / md:28px), one step below `.text-heading`.
 */
export function SectionHead({
  title,
  subtitle,
  action,
  className,
}: SectionHeadProps) {
  const heading = (
    <>
      <h2 className="text-section">{title}</h2>
      {subtitle ? (
        <p className="mt-2 max-w-[560px] text-muted-foreground">{subtitle}</p>
      ) : null}
    </>
  );

  if (action) {
    return (
      <div
        className={cn("mb-9 flex items-end justify-between gap-6", className)}
      >
        <div>{heading}</div>
        {action}
      </div>
    );
  }

  return <div className={cn("mb-9", className)}>{heading}</div>;
}
