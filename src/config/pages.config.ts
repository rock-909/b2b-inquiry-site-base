export const NAVIGATION_MESSAGE_KEYS = [
  "navigation.home",
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

interface PublicStaticPageSitemapConfig {
  include: boolean;
}

export interface PublicStaticPageDefinition {
  pageType: string;
  path: string;
  navigationKey: NavigationMessageKey | null;
  sitemap: PublicStaticPageSitemapConfig;
  contentSlug: string | null;
}

function toSitemapStaticPath(path: string): string {
  return path === "/" ? "" : path;
}

// The only place a static page is registered: PageType, the proxy allowlist,
// next-intl pathnames, sitemap, navigation, footer, lighthouserc.js and the
// deploy smoke route list all derive from this array.
// Node scripts require this file directly (no build step, no node_modules in
// some deploy jobs), so keep it free of runtime imports.
export const PUBLIC_STATIC_PAGE_DEFINITIONS = [
  {
    pageType: "home",
    path: "/",
    navigationKey: "navigation.home",
    sitemap: { include: true },
    contentSlug: null,
  },
  {
    pageType: "contact",
    path: "/contact",
    navigationKey: "navigation.contactSales",
    sitemap: { include: true },
    contentSlug: "contact",
  },
  {
    pageType: "privacy",
    path: "/privacy",
    navigationKey: null,
    sitemap: { include: false },
    contentSlug: "privacy",
  },
  {
    pageType: "terms",
    path: "/terms",
    navigationKey: null,
    sitemap: { include: false },
    contentSlug: "terms",
  },
] as const satisfies readonly PublicStaticPageDefinition[];

export type PageType =
  (typeof PUBLIC_STATIC_PAGE_DEFINITIONS)[number]["pageType"];

export function getStaticPageContentSlug(pageType: PageType): string {
  const slug = PUBLIC_STATIC_PAGE_DEFINITIONS.find(
    (definition) => definition.pageType === pageType,
  )?.contentSlug;
  if (!slug) throw new Error(`Page "${pageType}" has no contentSlug`);
  return slug;
}

export function getStaticSitemapPages(): string[] {
  return PUBLIC_STATIC_PAGE_DEFINITIONS.flatMap((definition) =>
    definition.sitemap.include ? [toSitemapStaticPath(definition.path)] : [],
  );
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
