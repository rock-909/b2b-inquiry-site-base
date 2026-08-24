import type { PageType } from "@/config/paths/types";

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
  path: string;
  navigationKey: NavigationMessageKey | null;
  sitemap: PublicStaticPageSitemapConfig;
  contentSlug: string | null;
}

function toSitemapStaticPath(path: string): string {
  return path === "/" ? "" : path;
}

export const PUBLIC_STATIC_PAGE_DEFINITIONS = [
  {
    pageType: "home",
    path: "/",
    navigationKey: "navigation.home",
    sitemap: { include: true, changeFrequency: "daily", priority: 1 },
    contentSlug: null,
  },
  {
    pageType: "products",
    path: "/products",
    navigationKey: "navigation.products",
    sitemap: { include: true, changeFrequency: "monthly", priority: 0.9 },
    contentSlug: null,
  },
  {
    pageType: "about",
    path: "/about",
    navigationKey: "navigation.about",
    sitemap: { include: true, changeFrequency: "monthly", priority: 0.8 },
    contentSlug: "about",
  },
  {
    pageType: "contact",
    path: "/contact",
    navigationKey: "navigation.contactSales",
    sitemap: { include: true, changeFrequency: "monthly", priority: 0.8 },
    contentSlug: "contact",
  },
  {
    pageType: "privacy",
    path: "/privacy",
    navigationKey: null,
    sitemap: { include: true, changeFrequency: "yearly", priority: 0.5 },
    contentSlug: "privacy",
  },
  {
    pageType: "terms",
    path: "/terms",
    navigationKey: null,
    sitemap: { include: true, changeFrequency: "yearly", priority: 0.5 },
    contentSlug: "terms",
  },
] as const satisfies readonly PublicStaticPageDefinition[];

export const PUBLIC_STATIC_PAGE_TYPES = PUBLIC_STATIC_PAGE_DEFINITIONS.map(
  (definition) => definition.pageType,
) as readonly PageType[];

export function getPublicStaticPageDefinition(
  pageType: PageType,
): PublicStaticPageDefinition | undefined {
  return PUBLIC_STATIC_PAGE_DEFINITIONS.find(
    (definition) => definition.pageType === pageType,
  );
}

export function getStaticSitemapPages(): string[] {
  return PUBLIC_STATIC_PAGE_DEFINITIONS.flatMap((definition) =>
    definition.sitemap.include ? [toSitemapStaticPath(definition.path)] : [],
  );
}

export function getStaticSitemapPageConfigByPath() {
  return Object.fromEntries(
    PUBLIC_STATIC_PAGE_DEFINITIONS.flatMap((definition) =>
      definition.sitemap.include
        ? [
            [
              toSitemapStaticPath(definition.path),
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

export function getStaticContentPageSlugByPath(): Record<string, string> {
  return Object.fromEntries(
    PUBLIC_STATIC_PAGE_DEFINITIONS.flatMap((definition) =>
      definition.contentSlug === null
        ? []
        : [[toSitemapStaticPath(definition.path), definition.contentSlug]],
    ),
  );
}
