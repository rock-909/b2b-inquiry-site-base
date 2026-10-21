/**
 * Logo Component
 *
 * Header brand link. Renders only when a derived site configures a ready
 * logo image; the template has none, so the header shows no brand element.
 */
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";

export function Logo() {
  const { logo } = SINGLE_SITE_CONFIG.brandAssets;
  if (logo?.status !== "ready") return null;

  return (
    <Link
      href="/"
      prefetch={false}
      className="flex max-w-full min-w-0 items-center rounded-sm transition-opacity hover:opacity-80"
      aria-label={SINGLE_SITE_CONFIG.name}
    >
      <Image
        src={logo.horizontal}
        alt={`${SINGLE_SITE_CONFIG.name} Logo`}
        width={logo.width}
        height={logo.height}
        className="h-8 w-auto transition-[filter,opacity] duration-200 dark:invert"
        decoding="async"
        loading="eager"
        unoptimized
      />
    </Link>
  );
}
