import {
  PUBLIC_STATIC_PAGE_TYPES,
  type PublicStaticPageChangeFrequency,
  getStaticSitemapPageConfigByPath,
  getStaticSitemapPages,
} from "@/config/pages.config";
import { OFFERINGS, getOfferingPath } from "@/config/offerings";
import type { PageType } from "@/config/paths/types";
import { getCanonicalPath } from "@/config/paths/utils";

export type SingleSiteSitemapChangeFrequency = PublicStaticPageChangeFrequency;
export interface SingleSiteSitemapPageConfig {
  changeFrequency: SingleSiteSitemapChangeFrequency;
  priority: number;
}

export function getSingleSitePublicStaticPageRoutes() {
  return [...PUBLIC_STATIC_PAGE_TYPES];
}

export function getSingleSitePublicStaticPages(): string[] {
  return getStaticSitemapPages();
}

export function shouldIndexPublicPage(
  pageType: PageType,
  path: string,
): boolean {
  const normalizedPath = path.trim() === "/" ? "" : path.trim();
  const canonicalPath = getCanonicalPath(pageType);
  const normalizedCanonicalPath = canonicalPath === "/" ? "" : canonicalPath;

  if (pageType === "products") {
    return (
      normalizedPath === normalizedCanonicalPath ||
      OFFERINGS.some(
        (offering) => getOfferingPath(offering.id) === normalizedPath,
      )
    );
  }

  return (
    PUBLIC_STATIC_PAGE_TYPES.includes(pageType) &&
    normalizedPath === normalizedCanonicalPath
  );
}

export function getSingleSiteSitemapPageConfigByPath(): Readonly<
  Record<string, SingleSiteSitemapPageConfig>
> {
  return getStaticSitemapPageConfigByPath();
}

export const SINGLE_SITE_PUBLIC_STATIC_PAGE_ROUTES =
  getSingleSitePublicStaticPageRoutes();
export const SINGLE_SITE_PUBLIC_STATIC_PAGES = getSingleSitePublicStaticPages();
export const SINGLE_SITE_SITEMAP_DEFAULT_CONFIG = {
  changeFrequency: "weekly",
  priority: 0.5,
} as const satisfies SingleSiteSitemapPageConfig;
// 注意不要 disallow /_next/：Googlebot 渲染页面需要拉取 /_next/static 下的
// JS/CSS，屏蔽它会导致渲染抓取失败、索引质量下降（Search Console 会报
// "Page fetch" 错误）。需要私有的路径不该放在 /_next/ 下面。
export const SINGLE_SITE_ROBOTS_DISALLOW_PATHS = ["/api/"] as const;

export function getSingleSiteSitemapPageConfig(
  path: string,
): SingleSiteSitemapPageConfig {
  return (
    getSingleSiteSitemapPageConfigByPath()[path] ??
    SINGLE_SITE_SITEMAP_DEFAULT_CONFIG
  );
}
