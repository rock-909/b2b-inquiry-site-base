import { notFound } from "next/navigation";
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import { routing, type Locale } from "@/i18n/routing-config";

export function isLocale(input: string): input is Locale {
  return (routing.locales as readonly string[]).includes(input);
}

export function coerceLocale(input: string | null | undefined): Locale {
  return input && isLocale(input) ? input : LOCALES_CONFIG.defaultLocale;
}

/**
 * 页面层解析路由 locale 参数的唯一入口。
 * 拿到非配置内的值时直接 404——把静默的类型硬转换变成响亮的失败。
 */
export function resolveLocaleParam(params: { locale: string }): Locale {
  if (!isLocale(params.locale)) {
    notFound();
  }
  return params.locale;
}
