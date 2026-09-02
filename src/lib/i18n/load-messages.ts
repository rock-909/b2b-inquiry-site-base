/**
 * Translation Message Loader
 *
 * Runtime canonical source is the locale file under `messages/base/**`.
 */

import { type Locale } from "@/i18n/routing-config";
import { coerceLocale } from "@/i18n/locale-utils";
import enMessages from "@messages/base/en/messages.json";
import esMessages from "@messages/base/es/messages.json";
import {
  getSiteMessageValues,
  type SiteMessageValues,
} from "@/lib/i18n/site-message-values";

type Messages = Record<string, unknown>;

const SOURCE_MESSAGES: Record<Locale, Messages> = {
  en: enMessages,
  es: esMessages,
};

function interpolateSiteMessageString(
  value: string,
  siteValues: SiteMessageValues,
): string {
  const replacements: Record<string, string> = {
    siteName: siteValues.siteName,
    companyName: siteValues.companyName,
    currentYear: siteValues.currentYear,
  };

  return value.replace(
    /\{(siteName|companyName|currentYear)\}/gu,
    (match, key: string) => replacements[key] ?? match,
  );
}

function interpolateSiteMessageValues(
  value: unknown,
  siteValues: SiteMessageValues,
): unknown {
  if (typeof value === "string") {
    return interpolateSiteMessageString(value, siteValues);
  }

  if (Array.isArray(value)) {
    return value.map((item) => interpolateSiteMessageValues(item, siteValues));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        interpolateSiteMessageValues(item, siteValues),
      ]),
    );
  }

  return value;
}

async function loadMessageSource(locale: Locale): Promise<Messages> {
  const safeLocale = coerceLocale(locale);
  const loadedMessages = getSourceMessages(safeLocale);
  const siteValues = await getSiteMessageValues();

  return interpolateSiteMessageValues(loadedMessages, siteValues) as Messages;
}

export function getSourceMessages(locale: Locale): Messages {
  return SOURCE_MESSAGES[coerceLocale(locale)];
}

export function loadCompleteMessages(locale: string): Promise<Messages> {
  return loadMessageSource(coerceLocale(locale));
}
