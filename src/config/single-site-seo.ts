import { PUBLIC_STATIC_PAGE_DEFINITIONS } from "@/config/pages.config";
import type { PageType } from "@/config/paths/types";
import { getCanonicalPath } from "@/config/paths/utils";

export function shouldIndexPublicPage(
  pageType: PageType,
  path: string,
): boolean {
  const normalizedPath = path.trim() === "/" ? "" : path.trim();
  const canonicalPath = getCanonicalPath(pageType);
  const normalizedCanonicalPath = canonicalPath === "/" ? "" : canonicalPath;

  return (
    PUBLIC_STATIC_PAGE_DEFINITIONS.some(
      (page) => page.pageType === pageType && page.sitemap.include,
    ) && normalizedPath === normalizedCanonicalPath
  );
}

// 注意不要 disallow /_next/：Googlebot 渲染页面需要拉取 /_next/static 下的
// JS/CSS，屏蔽它会导致渲染抓取失败、索引质量下降（Search Console 会报
// "Page fetch" 错误）。需要私有的路径不该放在 /_next/ 下面。
export const SINGLE_SITE_ROBOTS_DISALLOW_PATHS = ["/api/"] as const;
