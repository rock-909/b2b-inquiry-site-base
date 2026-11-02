import type { ConfiguredLocale } from "@/config/paths/locales-config";

/**
 * 访客选过的站点语言。语言建议条（切换或关闭）和头部、移动端语言菜单都写这一个键，
 * 三处读到的是同一个值。属于必要的偏好存储，不涉及分析或广告同意。
 */
export const PREFERRED_LOCALE_STORAGE_KEY = "preferred-locale";

export function rememberPreferredLocale(locale: ConfiguredLocale): void {
  try {
    window.localStorage.setItem(PREFERRED_LOCALE_STORAGE_KEY, locale);
  } catch {
    // 存储不可用时只是记不住选择，切换本身照常进行。
  }
}

/**
 * 判断要不要建议另一种语言，返回建议的语言或 null：
 * 已记住的选择优先，没有时按 navigator.languages（回退 navigator.language）顺序匹配站点语言；
 * 建议的语言必须不同于当前页面，并且当前页面声明了它的 hreflang 备用地址（404 页没有）。
 *
 * 客户端直接调用它，服务端也把它序列化进首屏绘制前运行的内联脚本，两边因此不会判断不一致。
 * 所以函数体只能用参数和浏览器全局对象，不能引用本模块的其他变量或导入。
 */
export function findSuggestedLocale<Locale extends string>(
  currentLocale: Locale,
  locales: readonly Locale[],
  storageKey: string,
): Locale | null {
  // 完全一致（en、pt-br）优先，其次是浏览器标签带地区（es-MX → es），
  // 最后是浏览器只给语言（pt → pt-BR）。不在不同地区变体之间互相猜（zh-TW 不会映射到 zh-CN）。
  const match = (tag: string): Locale | undefined => {
    const browserTag = tag.toLowerCase();
    return (
      locales.find((locale) => locale.toLowerCase() === browserTag) ??
      locales.find((locale) =>
        browserTag.startsWith(`${locale.toLowerCase()}-`),
      ) ??
      locales.find(
        (locale) =>
          !browserTag.includes("-") &&
          locale.toLowerCase().split("-")[0] === browserTag,
      )
    );
  };

  let preferred: Locale | undefined;
  // 隐私模式、禁用站点数据等情况下 localStorage 访问会抛错；读不到就当没有记录。
  try {
    const stored = window.localStorage.getItem(storageKey);
    preferred = locales.find((locale) => locale === stored);
  } catch {
    preferred = undefined;
  }
  if (preferred === undefined) {
    const { languages, language } = window.navigator;
    const tags = languages && languages.length > 0 ? languages : [language];
    for (const tag of tags) {
      preferred = match(tag);
      if (preferred !== undefined) break;
    }
  }

  return preferred !== undefined &&
    preferred !== currentLocale &&
    document.head.querySelector(
      `link[rel="alternate"][hreflang="${CSS.escape(preferred)}"]`,
    ) !== null
    ? preferred
    : null;
}
