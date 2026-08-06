import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

export function generateMetadata(): Metadata {
  return {
    robots: {
      index: false,
      follow: false,
    },
  };
}

/**
 * Catch-all route for unmatched paths under /[locale]/...
 *
 * Without this, Next.js renders its default 404 page instead of
 * the custom not-found.tsx in the [locale] segment. This ensures
 * users see the localized 404 page with a "Go Home" button.
 *
 * The placeholder paths call notFound() during prerender so the localized
 * custom 404 output is generated for each configured locale.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({
    locale,
    rest: ["__not-found-placeholder"],
  }));
}

export default function CatchAllNotFound() {
  notFound();
}
