import type { LocalizedPath, PageType } from "@/config/paths/types";

export const NAVIGATION_MESSAGE_KEYS = [
  "navigation.home",
  "navigation.products",
  "navigation.about",
  "navigation.contactSales",
] as const;

export type NavigationMessageKey = (typeof NAVIGATION_MESSAGE_KEYS)[number];
export type NavigationNamespaceKey =
  NavigationMessageKey extends `navigation.${infer Rest}` ? Rest : never;

export function toNavigationNamespaceKey(
  key: NavigationMessageKey,
): NavigationNamespaceKey {
  if (!key.startsWith("navigation.")) {
    throw new Error(`Expected navigation message key, received: ${key}`);
  }
  return key.slice("navigation.".length) as NavigationNamespaceKey;
}

export type PublicStaticPageChangeFrequency =
  "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

interface PublicStaticPageSitemapConfig {
  include: boolean;
  changeFrequency: PublicStaticPageChangeFrequency;
  priority: number;
}

export interface PublicStaticPageDefinition {
  pageType: PageType;
  localizedPaths: LocalizedPath;
  navigationKey: NavigationMessageKey | null;
  sitemap: PublicStaticPageSitemapConfig;
  mdxCollection: { collection: "pages"; slug: string } | null;
  routeOwner: string;
}

function localizedPath(path: string): LocalizedPath {
  return Object.freeze({ en: path });
}

function toSitemapStaticPath(path: string): string {
  return path === "/" ? "" : path;
}

export const PUBLIC_STATIC_PAGE_DEFINITIONS = Object.freeze([
  {
    pageType: "home",
    localizedPaths: localizedPath("/"),
    navigationKey: "navigation.home",
    sitemap: { include: true, changeFrequency: "daily", priority: 1 },
    mdxCollection: null,
    routeOwner: "src/app/[locale]/page.tsx",
  },
  {
    pageType: "products",
    localizedPaths: localizedPath("/products"),
    navigationKey: "navigation.products",
    sitemap: { include: true, changeFrequency: "monthly", priority: 0.9 },
    mdxCollection: null,
    routeOwner: "src/app/[locale]/products/page.tsx",
  },
  {
    pageType: "about",
    localizedPaths: localizedPath("/about"),
    navigationKey: "navigation.about",
    sitemap: { include: true, changeFrequency: "monthly", priority: 0.8 },
    mdxCollection: { collection: "pages", slug: "about" },
    routeOwner: "src/app/[locale]/about/page.tsx",
  },
  {
    pageType: "requestQuote",
    localizedPaths: localizedPath("/request-quote"),
    navigationKey: null,
    sitemap: { include: true, changeFrequency: "monthly", priority: 0.9 },
    mdxCollection: null,
    routeOwner: "src/app/[locale]/request-quote/page.tsx",
  },
  {
    pageType: "contact",
    localizedPaths: localizedPath("/contact"),
    navigationKey: "navigation.contactSales",
    sitemap: { include: true, changeFrequency: "monthly", priority: 0.8 },
    mdxCollection: { collection: "pages", slug: "contact" },
    routeOwner: "src/app/[locale]/contact/page.tsx",
  },
  {
    pageType: "privacy",
    localizedPaths: localizedPath("/privacy"),
    navigationKey: null,
    sitemap: { include: true, changeFrequency: "yearly", priority: 0.5 },
    mdxCollection: { collection: "pages", slug: "privacy" },
    routeOwner: "src/app/[locale]/privacy/page.tsx",
  },
  {
    pageType: "terms",
    localizedPaths: localizedPath("/terms"),
    navigationKey: null,
    sitemap: { include: true, changeFrequency: "yearly", priority: 0.5 },
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

export function getStaticSitemapPageConfigByPath() {
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
            ],
          ]
        : [],
    ),
  ) as Record<
    string,
    { changeFrequency: PublicStaticPageChangeFrequency; priority: number }
  >;
}

export function getMdxPageSlugByStaticPath(): Record<string, string> {
  return Object.fromEntries(
    PUBLIC_STATIC_PAGE_DEFINITIONS.flatMap((definition) =>
      definition.mdxCollection === null
        ? []
        : [
            [
              toSitemapStaticPath(definition.localizedPaths.en),
              definition.mdxCollection.slug,
            ],
          ],
    ),
  );
}
