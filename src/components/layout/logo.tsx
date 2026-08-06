/**
 * Logo Component
 *
 * Responsive logo component with proper accessibility and theming support.
 * Supports both text and image logos with automatic dark mode handling.
 */
import Image from "next/image";
import { getPublicLogoPath } from "@/config/public-trust";
import { Link } from "@/i18n/routing";
import { SINGLE_SITE_FACTS } from "@/config/single-site";
import { cn } from "@/lib/utils";
import { SITE_CONFIG } from "@/config/paths/site-config";

export interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  ariaLabel?: string;
  locale?: string | undefined;
  constrainText?: boolean;
}

function getSizeClass(sizeValue: "sm" | "md" | "lg"): string {
  switch (sizeValue) {
    case "sm":
      return "h-6 w-auto";
    case "md":
      return "h-8 w-auto";
    case "lg":
      return "h-10 w-auto";
    default:
      return "h-8 w-auto";
  }
}

function getTextSizeClass(sizeValue: "sm" | "md" | "lg"): string {
  switch (sizeValue) {
    case "sm":
      return "text-lg";
    case "md":
      return "text-xl";
    case "lg":
      return "text-2xl";
    default:
      return "text-xl";
  }
}

export function Logo({
  className,
  showText = true,
  size = "md",
  ariaLabel = SITE_CONFIG.name,
  constrainText = false,
}: LogoProps) {
  const { width, height } = SINGLE_SITE_FACTS.brandAssets.logo;
  const logoPath = getPublicLogoPath();
  const shouldShowText = showText || !logoPath;

  return (
    <Link
      href="/"
      prefetch={false}
      className={cn(
        "flex max-w-full min-w-0 items-center gap-2 transition-opacity hover:opacity-80",
        className,
      )}
      aria-label={ariaLabel}
    >
      {logoPath ? (
        <Image
          src={logoPath}
          alt={`${SITE_CONFIG.name} Logo`}
          width={width}
          height={height}
          className={cn(
            "transition-[filter,opacity] duration-200 dark:invert",
            getSizeClass(size),
          )}
          decoding="async"
          loading="eager"
          unoptimized
        />
      ) : null}

      {/* Keep the brand name visible until real logo assets are public-ready. */}
      {shouldShowText && (
        <span
          className={cn(
            "header-brand-text block min-w-0 truncate font-semibold text-foreground",
            constrainText ? "max-w-[220px] truncate" : undefined,
            logoPath ? "header-logo-text-desktop-only" : undefined,
            getTextSizeClass(size),
          )}
        >
          {SITE_CONFIG.name}
        </span>
      )}
    </Link>
  );
}
