/**
 * 固定的双语言 fixture，替换 `@/config/paths/locales-config`。
 *
 * 语言切换的行为（链接目标、保留 query/hash、默认语言不带前缀）至少要两个
 * locale 才能观察到；它和站点现在配置了几种语言无关。测试用这份固定配置，
 * 派生站去掉或增加语言时这些测试不用改。
 *
 * 用法（setup 已经加载过路径模块，所以先清模块缓存）：
 *   vi.hoisted(() => vi.resetModules());
 *   vi.mock("@/config/paths/locales-config", () => import("@/test/two-locales"));
 */

import type { ConfiguredLocale } from "@/config/paths/locales-config";

export const LOCALES_CONFIG = {
  locales: ["en", "de"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  displayNames: { en: "English", de: "Deutsch" },
  triggerLabels: { en: "English", de: "Deutsch" },
  timeZones: { en: "UTC", de: "Europe/Berlin" },
} as const;

/** 组件 props 的类型是真实配置的 locale 联合；fixture 的第二语言只在这里转换一次。 */
export const DEFAULT_LOCALE = "en" as ConfiguredLocale;
export const OTHER_LOCALE = "de" as ConfiguredLocale;
