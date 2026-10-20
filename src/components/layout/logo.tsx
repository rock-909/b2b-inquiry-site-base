/**
 * Logo Component
 *
 * Responsive logo component with proper accessibility and theming support.
 * Supports both text and image logos with automatic dark mode handling.
 */
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";
import { cn } from "@/lib/utils";

export function Logo() {
  const { logo } = SINGLE_SITE_CONFIG.brandAssets;
  const logoPath = logo?.status === "ready" ? logo.horizontal : undefined;

  return (
    <Link
      href="/"
      prefetch={false}
      className="flex max-w-full min-w-0 items-center gap-2 rounded-sm transition-opacity hover:opacity-80"
      aria-label={SINGLE_SITE_CONFIG.name}
    >
      {logoPath && logo ? (
        <Image
          src={logoPath}
          alt={`${SINGLE_SITE_CONFIG.name} Logo`}
          width={logo.width}
          height={logo.height}
          className="h-8 w-auto transition-[filter,opacity] duration-200 dark:invert"
          decoding="async"
          loading="eager"
          unoptimized
        />
      ) : null}

      {/* Keep the brand name visible until real logo assets are public-ready. */}
      <span
        className={cn(
          "block min-w-0 truncate text-xl font-semibold text-foreground",
          logoPath ? "header-logo-text-desktop-only" : undefined,
        )}
      >
        {SINGLE_SITE_CONFIG.name}
      </span>
    </Link>
  );
}
