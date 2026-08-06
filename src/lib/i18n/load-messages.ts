/**
 * Translation Message Loader
 *
 * Runtime canonical source is physical message packs under
 * `messages/base/**` and `messages/profiles/**`.
 */

import { type Locale } from "@/i18n/routing-config";
import { coerceLocale } from "@/i18n/locale-utils";
import { getComposedMessages } from "@/lib/i18n/composed-messages";
import {
  getSiteMessageValues,
  type SiteMessageValues,
} from "@/lib/i18n/site-message-values";

type Messages = Record<string, unknown>;

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

function loadMessageSource(locale: Locale): Messages {
  const safeLocale = coerceLocale(locale);
  const loadedMessages = getComposedMessages(safeLocale);
  const siteValues = getSiteMessageValues();

  return interpolateSiteMessageValues(loadedMessages, siteValues) as Messages;
}

export function loadCompleteMessages(locale: string): Promise<Messages> {
  return Promise.resolve(loadMessageSource(coerceLocale(locale)));
}
