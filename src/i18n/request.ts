import { getRequestConfig } from "next-intl/server";
import { locale as getRootLocale } from "next/root-params";
import { loadCompleteMessages } from "@/lib/i18n/load-messages";
import {
  getLocaleCurrency,
  getLocaleTimeZone,
} from "@/config/paths/locales-config";
import { coerceLocale } from "@/i18n/locale-utils";
import type { Locale } from "@/i18n/routing-config";

// 辅助函数：获取格式配置
function getFormats(locale: Locale) {
  return {
    dateTime: {
      short: {
        day: "numeric" as const,
        month: "short" as const,
        year: "numeric" as const,
      },
      long: {
        day: "numeric" as const,
        month: "long" as const,
        year: "numeric" as const,
        weekday: "long" as const,
      },
    },
    number: {
      precise: {
        maximumFractionDigits: 5,
      },
      currency: {
        style: "currency" as const,
        currency: getLocaleCurrency(locale),
      },
      percentage: {
        style: "percent" as const,
        minimumFractionDigits: 1,
      },
    },
    list: {
      enumeration: {
        style: "long" as const,
        type: "conjunction" as const,
      },
    },
  };
}

export default getRequestConfig(async () => {
  const locale = coerceLocale(await getRootLocale());
  const messages = await loadCompleteMessages(locale);

  return {
    locale,
    messages,
    timeZone: getLocaleTimeZone(locale),
    formats: getFormats(locale),
    strictMessageTypeSafety: true,
  };
});
