import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[var(--button-radius)] text-sm font-medium whitespace-nowrap transition-[background-color,color,border-color,box-shadow] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)] hover:bg-[var(--button-primary-hover-bg)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-[color-mix(in_oklch,var(--destructive)_90%,black)] focus-visible:ring-destructive",
        outline:
          "border-2 border-[var(--button-outline-border)] bg-transparent text-[var(--button-outline-fg)] hover:bg-[var(--button-outline-hover-bg)]",
        secondary:
          "border border-border bg-secondary text-secondary-foreground shadow-[var(--shadow-xs)] hover:border-[var(--button-secondary-hover-border)] hover:shadow-[var(--shadow-sm)]",
        ghost: "hover:bg-accent hover:text-foreground",
        link: "text-[var(--button-outline-fg)] underline-offset-4 hover:underline",
        accent:
          "bg-accent text-accent-foreground hover:bg-[var(--button-accent-hover-bg)]",
        "on-dark":
          "bg-[var(--neutral-1)] text-primary hover:bg-[color-mix(in_oklch,var(--neutral-1)_90%,transparent)]",
        "ghost-dark":
          "border border-[color-mix(in_oklch,var(--neutral-1)_30%,transparent)] bg-transparent text-[var(--neutral-1)] hover:border-[color-mix(in_oklch,var(--neutral-1)_50%,transparent)] hover:bg-[color-mix(in_oklch,var(--neutral-1)_8%,transparent)]",
      },
      size: {
        default: "h-[var(--button-height-default)] px-5 py-2.5 has-[>svg]:px-4",
        sm: "h-[var(--button-height-sm)] gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-[var(--button-height-lg)] px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
