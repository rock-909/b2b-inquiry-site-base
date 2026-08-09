import { cn } from "@/lib/utils";

const BASE_CLASSES =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[var(--button-radius)] text-sm font-medium whitespace-nowrap transition-[background-color,color,border-color,box-shadow] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const VARIANT_CLASSES = {
  default:
    "bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)] hover:bg-[var(--button-primary-hover-bg)]",
  outline:
    "border-2 border-[var(--button-outline-border)] bg-transparent text-[var(--button-outline-fg)] hover:bg-[var(--button-outline-hover-bg)]",
  ghost: "hover:bg-accent hover:text-foreground",
} as const;

const SIZE_CLASSES = {
  default: "h-[var(--button-height-default)] px-5 py-2.5 has-[>svg]:px-4",
  sm: "h-[var(--button-height-sm)] gap-1.5 px-3 has-[>svg]:px-2.5",
  icon: "size-9",
} as const;

export type ButtonVariant = keyof typeof VARIANT_CLASSES;
export type ButtonSize = keyof typeof SIZE_CLASSES;

export function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  className?: string | undefined;
} = {}) {
  return cn(
    BASE_CLASSES,
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  );
}
