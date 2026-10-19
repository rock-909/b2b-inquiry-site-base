import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PUBLIC_STATIC_PAGE_DEFINITIONS } from "@/config/pages.config";
import {
  LOCALES_CONFIG,
  type ConfiguredLocale,
} from "@/config/paths/locales-config";
import { getStaticPage } from "@/lib/content/static-pages";

type Messages = typeof import("../../messages/base/en/messages.json");

export const DEFAULT_LOCALE = LOCALES_CONFIG.defaultLocale;
// 第一个非默认语种；单语种站点为 undefined，多语种用例据此跳过。
export const SECOND_LOCALE: ConfiguredLocale | undefined =
  LOCALES_CONFIG.locales.find((locale) => locale !== DEFAULT_LOCALE);

// localePrefix 为 "as-needed"：只有非默认语种带 URL 前缀。
export function localePrefix(locale: ConfiguredLocale): string {
  return locale === DEFAULT_LOCALE ? "" : `/${locale}`;
}

// 默认语种下的路径（如 "/"、"/contact"）在指定语种下的 URL 路径。
export function localizePath(locale: ConfiguredLocale, path: string): string {
  const prefix = localePrefix(locale);
  return path === "/" ? prefix || "/" : `${prefix}${path}`;
}

// 按需读取语种文件，删掉某个语种后不会在模块加载时崩溃。
export function getLocaleMessages(locale: ConfiguredLocale): Messages {
  return JSON.parse(
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- locale comes from LOCALES_CONFIG, path stays under messages/base
    readFileSync(
      join(__dirname, "../../messages/base", locale, "messages.json"),
      "utf8",
    ),
  ) as Messages;
}

export function getSitePageCases(locale: ConfiguredLocale) {
  const messages = getLocaleMessages(locale);
  return PUBLIC_STATIC_PAGE_DEFINITIONS.map(
    ({ path, contentSlug }) =>
      [
        localizePath(locale, path),
        // 首页短文案在 messages，其余页面标题在各自的内容模块。
        contentSlug === null
          ? messages.home.title
          : getStaticPage(contentSlug, locale).metadata.title,
      ] as const,
  );
}

export const SITE_PAGE_CASES = getSitePageCases(DEFAULT_LOCALE);
