/**
 * Translation Message Loader
 *
 * Runtime canonical source is the locale file under `messages/base/**`.
 */

import type { Locale } from "@/i18n/routing-config";
import { coerceLocale } from "@/i18n/locale-utils";
import enMessages from "@messages/base/en/messages.json";
import esMessages from "@messages/base/es/messages.json";

type Messages = Record<string, unknown>;

const SOURCE_MESSAGES: Record<Locale, Messages> = {
  en: enMessages,
  es: esMessages,
};

export function getSourceMessages(locale: Locale): Messages {
  return SOURCE_MESSAGES[coerceLocale(locale)];
}

// 消息文件原样使用：站点名等配置值由调用处直接读取 SINGLE_SITE_CONFIG，不在这里替换。
export function loadCompleteMessages(locale: string): Messages {
  return getSourceMessages(coerceLocale(locale));
}
