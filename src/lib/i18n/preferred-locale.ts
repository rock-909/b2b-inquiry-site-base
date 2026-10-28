import {
  LOCALES_CONFIG,
  type ConfiguredLocale,
} from "@/config/paths/locales-config";

/**
 * 访客选过的站点语言。语言建议条（切换或关闭）和头部、移动端语言菜单都写这一个键，
 * 三处读到的是同一个值。属于必要的偏好存储，不涉及分析或广告同意。
 */
export const PREFERRED_LOCALE_STORAGE_KEY = "preferred-locale";

const LOCALES: readonly ConfiguredLocale[] = LOCALES_CONFIG.locales;

function isConfiguredLocale(value: unknown): value is ConfiguredLocale {
  return LOCALES.includes(value as ConfiguredLocale);
}

// 隐私模式、禁用站点数据等情况下 localStorage 访问会抛错；读不到就当没有记录。
export function readPreferredLocale(): ConfiguredLocale | null {
  try {
    const stored = window.localStorage.getItem(PREFERRED_LOCALE_STORAGE_KEY);
    return isConfiguredLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function rememberPreferredLocale(locale: ConfiguredLocale): void {
  try {
    window.localStorage.setItem(PREFERRED_LOCALE_STORAGE_KEY, locale);
  } catch {
    // 存储不可用时只是记不住选择，切换本身照常进行。
  }
}

function primarySubtag(tag: string): string {
  return tag.split("-")[0] ?? tag;
}

function matchLanguageTag(tag: string): ConfiguredLocale | undefined {
  const browserTag = tag.toLowerCase();
  // 完全一致（en、pt-br）优先，其次是浏览器标签带地区（es-MX → es），
  // 最后是浏览器只给语言（pt → pt-BR）。不在不同地区变体之间互相猜（zh-TW 不会映射到 zh-CN）。
  return (
    LOCALES.find((locale) => locale.toLowerCase() === browserTag) ??
    LOCALES.find((locale) =>
      browserTag.startsWith(`${locale.toLowerCase()}-`),
    ) ??
    LOCALES.find(
      (locale) =>
        !browserTag.includes("-") &&
        primarySubtag(locale.toLowerCase()) === browserTag,
    )
  );
}

/** 按浏览器语言偏好顺序，返回第一个能对应到站点语言的结果。 */
export function matchBrowserLanguages(
  languages: readonly string[],
): ConfiguredLocale | null {
  for (const tag of languages) {
    const locale = matchLanguageTag(tag);
    if (locale) return locale;
  }
  return null;
}

/** 已记住的选择优先；没有时按 navigator.languages（回退 navigator.language）推断。 */
export function resolvePreferredLocale(): ConfiguredLocale | null {
  const remembered = readPreferredLocale();
  if (remembered) return remembered;

  const { languages, language } = window.navigator;
  return matchBrowserLanguages(
    languages && languages.length > 0 ? languages : [language],
  );
}
