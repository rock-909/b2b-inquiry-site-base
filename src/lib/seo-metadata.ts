import type { Metadata } from "next";
import { SITE_CONFIG, type Locale, type PageType } from "@/config/paths";
import { shouldIndexPublicPage } from "@/config/single-site-seo";
import { SINGLE_SITE_FACTS } from "@/config/single-site";
import { routing } from "@/i18n/routing-config";
import { getRuntimeAppEnv, getRuntimeEnvString } from "@/lib/env";
import { interpolate } from "@/lib/interpolate";

export type { Locale } from "@/config/paths";

interface SEOConfig {
  title?: string;
  description?: string;
  image?: string;
  type?: "website" | "article" | "product";
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  section?: string;
}

interface StaticPageMetadata {
  readonly title: string;
  readonly description?: string;
  readonly seo?: {
    readonly title?: string;
    readonly description?: string;
    readonly ogImage?: string;
  };
}

interface StaticPageMetadataConfigOptions {
  readonly includeImage?: boolean;
  readonly includeEmptyDescription?: boolean;
}

const FALLBACK_LOCALE: Locale = "en";
const DEFAULT_OG_IMAGE = SINGLE_SITE_FACTS.brandAssets.ogImage;

function resolveLocale(locale: Locale): Locale {
  return locale === FALLBACK_LOCALE ? locale : FALLBACK_LOCALE;
}

/** Replace ICU-style {placeholders} with SINGLE_SITE_FACTS values in SEO strings. */
const SEO_INTERPOLATION_MAP: Record<string, string | number> = {
  established: SINGLE_SITE_FACTS.company.established,
};

function interpolateSeoString(text: string): string {
  return interpolate(text, SEO_INTERPOLATION_MAP);
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed === "" || trimmed === "/") {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function buildCanonicalForPath(path: string): string {
  const normalizedPath = normalizePath(path);
  return new URL(
    normalizedPath === "" ? "/" : normalizedPath,
    SITE_CONFIG.baseUrl,
  ).toString();
}

export { buildCanonicalForPath };

function buildLanguagesForPath(path: string): Record<string, string> {
  const normalizedPath = normalizePath(path);

  const entries: Array<[string, string]> = routing.locales.map((locale) => [
    locale,
    new URL(
      normalizedPath === "" ? "/" : normalizedPath,
      SITE_CONFIG.baseUrl,
    ).toString(),
  ]);
  entries.push([
    "x-default",
    new URL(
      normalizedPath === "" ? "/" : normalizedPath,
      SITE_CONFIG.baseUrl,
    ).toString(),
  ]);

  return Object.fromEntries(entries);
}

const STATIC_PAGE_SEO_DEFAULTS = {
  type: "website",
  image: DEFAULT_OG_IMAGE,
} as const satisfies SEOConfig;

interface GenerateMetadataForPathParams {
  locale: Locale;
  pageType: PageType;
  path: string;
  config?: Partial<SEOConfig>;
}

const INACTIVE_PROFILE_ROBOTS = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
} as const satisfies Metadata["robots"];

const ACTIVE_PROFILE_ROBOTS = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-video-preview": -1,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
} as const satisfies Metadata["robots"];

function shouldIndexRuntimeEnvironment(): boolean {
  return getRuntimeAppEnv() === "production";
}

function resolveMetadataTitle(config: SEOConfig): string {
  if (config.title !== undefined && config.title.trim().length > 0) {
    return interpolateSeoString(config.title);
  }

  return SITE_CONFIG.seo.defaultTitle;
}

function resolveMetadataDescription(config: SEOConfig): string {
  if (
    config.description !== undefined &&
    config.description.trim().length > 0
  ) {
    return interpolateSeoString(config.description);
  }

  return SITE_CONFIG.seo.defaultDescription;
}

export function generateMetadataForPath(
  params: GenerateMetadataForPathParams,
): Metadata {
  const { locale, pageType, path, config } = params;
  const seoConfig = { ...STATIC_PAGE_SEO_DEFAULTS, ...config };
  const safeLocale = resolveLocale(locale);
  const canonical = buildCanonicalForPath(path);
  const languages = buildLanguagesForPath(path);
  const title = resolveMetadataTitle(seoConfig);
  const description = resolveMetadataDescription(seoConfig);
  const siteName = SITE_CONFIG.name;
  const openGraphType =
    (seoConfig.type === "product" ? "website" : seoConfig.type) || "website";

  const metadata: Metadata = {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName,
      locale: safeLocale,
      type: openGraphType,
      url: canonical,
      images: seoConfig.image ? [{ url: seoConfig.image }] : undefined,
      publishedTime: seoConfig.publishedTime,
      modifiedTime: seoConfig.modifiedTime,
      authors: seoConfig.authors,
      section: seoConfig.section,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: seoConfig.image ? [seoConfig.image] : undefined,
    },
    alternates: {
      canonical,
      languages,
    },
    robots: ACTIVE_PROFILE_ROBOTS,
    verification: {
      google: getRuntimeEnvString("GOOGLE_SITE_VERIFICATION"),
      yandex: getRuntimeEnvString("YANDEX_VERIFICATION"),
    },
  };

  if (
    !shouldIndexRuntimeEnvironment() ||
    !shouldIndexPublicPage(pageType, path)
  ) {
    metadata.robots = INACTIVE_PROFILE_ROBOTS;
  }

  return metadata;
}

export function createStaticPageMetadataConfig(
  metadata: StaticPageMetadata,
  options: StaticPageMetadataConfigOptions = {},
): Partial<SEOConfig> {
  const description = metadata.seo?.description ?? metadata.description;

  return {
    title: metadata.seo?.title ?? metadata.title,
    ...(description || (options.includeEmptyDescription && description === "")
      ? { description }
      : {}),
    ...(options.includeImage && metadata.seo?.ogImage
      ? { image: metadata.seo.ogImage }
      : {}),
  };
}
