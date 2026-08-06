import { PUBLIC_STATIC_PAGE_DEFINITIONS } from "@/config/pages.config";
import type { LocalizedPath, PageType } from "@/config/paths/types";

export const PATHS_CONFIG = Object.freeze(
  Object.fromEntries(
    PUBLIC_STATIC_PAGE_DEFINITIONS.map((definition) => [
      definition.pageType,
      definition.localizedPaths,
    ]),
  ),
) as Readonly<Record<PageType, LocalizedPath>>;
export type PathsConfig = typeof PATHS_CONFIG;
