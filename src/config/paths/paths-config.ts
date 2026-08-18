import { PUBLIC_STATIC_PAGE_DEFINITIONS } from "@/config/pages.config";
import type { PageType } from "@/config/paths/types";

export const PATHS_CONFIG = Object.fromEntries(
  PUBLIC_STATIC_PAGE_DEFINITIONS.map((definition) => [
    definition.pageType,
    definition.path,
  ]),
) as Readonly<Record<PageType, string>>;
export type PathsConfig = typeof PATHS_CONFIG;
