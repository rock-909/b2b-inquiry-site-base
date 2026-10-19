import type { Metadata } from "next";
import type { Locale, PageType } from "@/config/paths";
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import { shouldIndexPublicPage } from "@/config/single-site-seo";
import { SINGLE_SITE_CONFIG, SINGLE_SITE_FACTS } from "@/config/single-site";
import { routing } from "@/i18n/routing-config";
import { getLocalePath } from "@/config/paths/utils";
import { getRuntimeAppEnv, getRuntimeEnvString } from "@/lib/env";

export type { Locale } from "@/config/paths";

interface SEOConfig {
  title?: string;
  description?: string;
  image?: string;
  type?: "website" | "article";
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
}

const DEFAULT_OG_IMAGE = SINGLE_SITE_FACTS.brandAssets.ogImage;

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed === "" || trimmed === "/") {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function buildCanonicalForPath(
  path: string,
  locale: Locale = LOCALES_CONFIG.defaultLocale,
): string {
  const normalizedPath = normalizePath(path);
  return new URL(
    getLocalePath(locale, normalizedPath),
    SINGLE_SITE_CONFIG.baseUrl,
  ).toString();
}

export { buildCanonicalForPath };

export function buildLanguagesForPath(path: string): Record<string, string> {
  const normalizedPath = normalizePath(path);

  const entries: Array<[string, string]> = routing.locales.map((locale) => [
    locale,
    new URL(
      getLocalePath(locale, normalizedPath),
      SINGLE_SITE_CONFIG.baseUrl,
    ).toString(),
  ]);
  entries.push([
    "x-default",
    new URL(
      getLocalePath(routing.defaultLocale, normalizedPath),
      SINGLE_SITE_CONFIG.baseUrl,
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

export const NOINDEX_ROBOTS = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
} as const satisfies Metadata["robots"];

export const INDEXABLE_ROBOTS = {
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

export function buildVerification(): Metadata["verification"] {
  return {
    google: getRuntimeEnvString("GOOGLE_SITE_VERIFICATION"),
    yandex: getRuntimeEnvString("YANDEX_VERIFICATION"),
  };
}

function shouldIndexRuntimeEnvironment(): boolean {
  return getRuntimeAppEnv() === "production";
}

function resolveMetadataTitle(config: SEOConfig): string {
  if (config.title !== undefined && config.title.trim().length > 0) {
    return config.title;
  }

  return SINGLE_SITE_CONFIG.seo.defaultTitle;
}

function resolveMetadataDescription(config: SEOConfig): string {
  if (
    config.description !== undefined &&
    config.description.trim().length > 0
  ) {
    return config.description;
  }

  return SINGLE_SITE_CONFIG.seo.defaultDescription;
}

// Open Graph 要求 language_TERRITORY 形式（en_US），由语言代码推出最可能的地区。
function toOpenGraphLocale(locale: string): string {
  const { language, region } = new Intl.Locale(locale).maximize();
  return region ? `${language}_${region}` : language;
}

export function generateMetadataForPath(
  params: GenerateMetadataForPathParams,
): Metadata {
  const { locale, pageType, path, config } = params;
  const seoConfig = { ...STATIC_PAGE_SEO_DEFAULTS, ...config };
  const canonical = buildCanonicalForPath(path, locale);
  const languages = buildLanguagesForPath(path);
  const title = resolveMetadataTitle(seoConfig);
  const description = resolveMetadataDescription(seoConfig);
  const siteName = SINGLE_SITE_CONFIG.name;
  const openGraphType = seoConfig.type || "website";

  const metadata: Metadata = {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName,
      locale: toOpenGraphLocale(locale),
      type: openGraphType,
      url: canonical,
      images: seoConfig.image ? [{ url: seoConfig.image }] : undefined,
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
    robots: INDEXABLE_ROBOTS,
    verification: buildVerification(),
  };

  if (
    !shouldIndexRuntimeEnvironment() ||
    !shouldIndexPublicPage(pageType, path)
  ) {
    metadata.robots = NOINDEX_ROBOTS;
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
    ...(description ? { description } : {}),
    ...(options.includeImage && metadata.seo?.ogImage
      ? { image: metadata.seo.ogImage }
      : {}),
  };
}
