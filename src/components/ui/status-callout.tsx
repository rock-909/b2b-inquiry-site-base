import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

export type StatusCalloutTone = "info" | "success" | "warning" | "error";

const TONE_CLASS_NAMES = {
  info: "border-[var(--info-border)] bg-[var(--info-muted)] text-[var(--info-foreground)]",
  success:
    "border-[var(--success-border)] bg-[var(--success-muted)] text-[var(--success-foreground)]",
  warning:
    "border-[var(--warning-border)] bg-[var(--warning-muted)] text-[var(--warning-foreground)]",
  error:
    "border-[var(--error-border)] bg-[var(--error-muted)] text-[var(--error-foreground)]",
} satisfies Record<StatusCalloutTone, string>;

export interface StatusCalloutProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "children" | "color" | "title"
> {
  children: ReactNode;
  live?: boolean;
  ref?: Ref<HTMLDivElement> | undefined;
  title?: ReactNode;
  tone?: StatusCalloutTone;
}

function StatusCallout({
  children,
  className,
  live = true,
  ref,
  role,
  "aria-live": ariaLive,
  title,
  tone = "info",
  ...props
}: StatusCalloutProps) {
  const defaultRole = tone === "error" ? "alert" : "status";
  const defaultAriaLive = tone === "error" ? "assertive" : "polite";

  return (
    <div
      ref={ref}
      className={cn(
        "grid gap-2 rounded-lg border p-4 text-sm",
        TONE_CLASS_NAMES[tone],
        className,
      )}
      data-slot="status-callout"
      role={live ? (role ?? defaultRole) : role}
      aria-live={live ? (ariaLive ?? defaultAriaLive) : ariaLive}
      {...props}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      <div className={title ? "mt-1" : undefined}>{children}</div>
    </div>
  );
}

StatusCallout.displayName = "StatusCallout";

export { StatusCallout };
