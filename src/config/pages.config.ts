import type { LocalizedPath, PageType } from "@/config/paths/types";

const NAVIGATION_MESSAGE_PREFIX = "navigation." as const;

export const NAVIGATION_MESSAGE_KEYS = [
  "navigation.home",
  "navigation.products",
  "navigation.oemWholesale",
  "navigation.guides",
  "navigation.about",
  "navigation.contactSales",
] as const;

export type NavigationMessageKey = (typeof NAVIGATION_MESSAGE_KEYS)[number];

export type NavigationNamespaceKey =
  NavigationMessageKey extends `${typeof NAVIGATION_MESSAGE_PREFIX}${infer Rest}`
    ? Rest
    : never;

export function toNavigationNamespaceKey(
  key: NavigationMessageKey,
): NavigationNamespaceKey {
  if (!key.startsWith(NAVIGATION_MESSAGE_PREFIX)) {
    throw new Error(`Expected navigation message key, received: ${key}`);
  }

  return key.slice(NAVIGATION_MESSAGE_PREFIX.length) as NavigationNamespaceKey;
}

const STATIC_PAGE_LASTMOD_ISO = "2026-07-05T00:00:00Z";

export type PublicStaticPageChangeFrequency =
  "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

type PublicStaticPageSeoKey =
  | "home"
  | "content.pages.about"
  | "content.pages.oem-wholesale"
  | "content.pages.flood-barrier-materials-guide"
  | "content.pages.flood-barrier-specifications"
  | "content.pages.request-quote"
  | "content.pages.warranty"
  | "catalog.overview"
  | "content.pages.contact"
  | "content.pages.privacy"
  | "content.pages.terms";

interface PublicStaticPageSitemapConfig {
  include: boolean;
  changeFrequency: PublicStaticPageChangeFrequency;
  priority: number;
}

interface PublicStaticPageStaticLastmod {
  source: "static";
  iso: string;
}

interface PublicStaticPageMdxLastmod {
  source: "mdx";
}

interface PublicStaticPageMdxCollection {
  collection: "pages";
  slug: string;
}

export interface PublicStaticPageDefinition {
  pageType: PageType;
  localizedPaths: LocalizedPath;
  navigationKey: NavigationMessageKey | null;
  seoKey: PublicStaticPageSeoKey;
  sitemap: PublicStaticPageSitemapConfig;
  lastmod: PublicStaticPageStaticLastmod | PublicStaticPageMdxLastmod;
  mdxCollection: PublicStaticPageMdxCollection | null;
  routeOwner: string;
}

function localizedPath(path: string): LocalizedPath {
  return Object.freeze({
    en: path,
  });
}

function toSitemapStaticPath(path: string): string {
  return path === "/" ? "" : path;
}

export const PUBLIC_STATIC_PAGE_DEFINITIONS: readonly PublicStaticPageDefinition[] =
  Object.freeze([
    {
      pageType: "home",
      localizedPaths: localizedPath("/"),
      navigationKey: "navigation.home",
      seoKey: "home",
      sitemap: { include: true, changeFrequency: "daily", priority: 1 },
      lastmod: { source: "static", iso: STATIC_PAGE_LASTMOD_ISO },
      mdxCollection: null,
      routeOwner: "src/app/[locale]/page.tsx",
    },
    {
      pageType: "products",
      localizedPaths: localizedPath("/products"),
      navigationKey: "navigation.products",
      seoKey: "catalog.overview",
      sitemap: { include: true, changeFrequency: "weekly", priority: 0.9 },
      lastmod: { source: "static", iso: STATIC_PAGE_LASTMOD_ISO },
      mdxCollection: null,
      routeOwner: "src/app/[locale]/products/page.tsx",
    },
    {
      pageType: "oemWholesale",
      localizedPaths: localizedPath("/oem-wholesale"),
      navigationKey: "navigation.oemWholesale",
      seoKey: "content.pages.oem-wholesale",
      sitemap: { include: true, changeFrequency: "monthly", priority: 0.85 },
      lastmod: { source: "mdx" },
      mdxCollection: { collection: "pages", slug: "oem-wholesale" },
      routeOwner: "src/app/[locale]/oem-wholesale/page.tsx",
    },
    {
      pageType: "materialsGuide",
      localizedPaths: localizedPath("/guides/flood-barrier-materials-guide"),
      navigationKey: "navigation.guides",
      seoKey: "content.pages.flood-barrier-materials-guide",
      sitemap: { include: true, changeFrequency: "monthly", priority: 0.8 },
      lastmod: { source: "mdx" },
      mdxCollection: {
        collection: "pages",
        slug: "flood-barrier-materials-guide",
      },
      routeOwner:
        "src/app/[locale]/guides/flood-barrier-materials-guide/page.tsx",
    },
    {
      pageType: "specificationsGuide",
      localizedPaths: localizedPath("/guides/flood-barrier-specifications"),
      navigationKey: null,
      seoKey: "content.pages.flood-barrier-specifications",
      sitemap: { include: true, changeFrequency: "monthly", priority: 0.8 },
      lastmod: { source: "mdx" },
      mdxCollection: {
        collection: "pages",
        slug: "flood-barrier-specifications",
      },
      routeOwner:
        "src/app/[locale]/guides/flood-barrier-specifications/page.tsx",
    },
    {
      pageType: "about",
      localizedPaths: localizedPath("/about"),
      navigationKey: "navigation.about",
      seoKey: "content.pages.about",
      sitemap: { include: true, changeFrequency: "monthly", priority: 0.8 },
      lastmod: { source: "mdx" },
      mdxCollection: { collection: "pages", slug: "about" },
      routeOwner: "src/app/[locale]/about/page.tsx",
    },
    {
      pageType: "requestQuote",
      localizedPaths: localizedPath("/request-quote"),
      navigationKey: null,
      seoKey: "content.pages.request-quote",
      sitemap: { include: true, changeFrequency: "monthly", priority: 0.9 },
      lastmod: { source: "static", iso: STATIC_PAGE_LASTMOD_ISO },
      mdxCollection: null,
      routeOwner: "src/app/[locale]/request-quote/page.tsx",
    },
    {
      pageType: "contact",
      localizedPaths: localizedPath("/contact"),
      navigationKey: null,
      seoKey: "content.pages.contact",
      sitemap: { include: true, changeFrequency: "monthly", priority: 0.8 },
      lastmod: { source: "mdx" },
      mdxCollection: { collection: "pages", slug: "contact" },
      routeOwner: "src/app/[locale]/contact/page.tsx",
    },
    {
      pageType: "warranty",
      localizedPaths: localizedPath("/warranty"),
      navigationKey: null,
      seoKey: "content.pages.warranty",
      sitemap: { include: true, changeFrequency: "monthly", priority: 0.7 },
      lastmod: { source: "mdx" },
      mdxCollection: { collection: "pages", slug: "warranty" },
      routeOwner: "src/app/[locale]/warranty/page.tsx",
    },
    {
      pageType: "privacy",
      localizedPaths: localizedPath("/privacy"),
      navigationKey: null,
      seoKey: "content.pages.privacy",
      sitemap: { include: true, changeFrequency: "monthly", priority: 0.7 },
      lastmod: { source: "mdx" },
      mdxCollection: { collection: "pages", slug: "privacy" },
      routeOwner: "src/app/[locale]/privacy/page.tsx",
    },
    {
      pageType: "terms",
      localizedPaths: localizedPath("/terms"),
      navigationKey: null,
      seoKey: "content.pages.terms",
      sitemap: { include: true, changeFrequency: "monthly", priority: 0.7 },
      lastmod: { source: "mdx" },
      mdxCollection: { collection: "pages", slug: "terms" },
      routeOwner: "src/app/[locale]/terms/page.tsx",
    },
  ] as const satisfies readonly PublicStaticPageDefinition[]);

export const PUBLIC_STATIC_PAGE_TYPES = PUBLIC_STATIC_PAGE_DEFINITIONS.map(
  (definition) => definition.pageType,
) as readonly PageType[];

export function getStaticPageDefinitionsByType(): Readonly<
  Partial<Record<PageType, PublicStaticPageDefinition>>
> {
  return Object.freeze(
    Object.fromEntries(
      PUBLIC_STATIC_PAGE_DEFINITIONS.map((definition) => [
        definition.pageType,
        definition,
      ]),
    ),
  ) as Partial<Record<PageType, PublicStaticPageDefinition>>;
}

export function getPublicStaticPageDefinition(
  pageType: PageType,
): PublicStaticPageDefinition | undefined {
  return getStaticPageDefinitionsByType()[pageType];
}

export function getStaticSitemapPages(): string[] {
  return PUBLIC_STATIC_PAGE_DEFINITIONS.flatMap((definition) =>
    definition.sitemap.include
      ? [toSitemapStaticPath(definition.localizedPaths.en)]
      : [],
  );
}

export function getStaticSitemapPageConfigByPath(): Record<
  string,
  {
    changeFrequency: PublicStaticPageChangeFrequency;
    priority: number;
  }
> {
  return Object.fromEntries(
    PUBLIC_STATIC_PAGE_DEFINITIONS.flatMap((definition) =>
      definition.sitemap.include
        ? [
            [
              toSitemapStaticPath(definition.localizedPaths.en),
              {
                changeFrequency: definition.sitemap.changeFrequency,
                priority: definition.sitemap.priority,
              },
            ] as const,
          ]
        : [],
    ),
  );
}

export function getStaticPageLastmodByPath(): Record<string, string> {
  const entries = PUBLIC_STATIC_PAGE_DEFINITIONS.flatMap((definition) => {
    if (definition.lastmod.source !== "static") {
      return [];
    }

    return [
      [
        toSitemapStaticPath(definition.localizedPaths.en),
        definition.lastmod.iso,
      ] as const,
    ];
  });

  return Object.fromEntries(entries);
}

export function getMdxPageSlugByStaticPath(): Record<string, string> {
  const entries = PUBLIC_STATIC_PAGE_DEFINITIONS.flatMap((definition) => {
    if (definition.mdxCollection === null) {
      return [];
    }

    return [
      [
        toSitemapStaticPath(definition.localizedPaths.en),
        definition.mdxCollection.slug,
      ] as const,
    ];
  });

  return Object.fromEntries(entries);
}
