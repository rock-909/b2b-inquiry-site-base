import { getRequestConfig } from "next-intl/server";
import { locale as getRootLocale } from "next/root-params";
import { loadCompleteMessages } from "@/lib/i18n/load-messages";
import { getLocaleTimeZone } from "@/config/paths/locales-config";
import { coerceLocale } from "@/i18n/locale-utils";

export default getRequestConfig(async () => {
  const locale = coerceLocale(await getRootLocale());
  const messages = await loadCompleteMessages(locale);

  return {
    locale,
    messages,
    timeZone: getLocaleTimeZone(locale),
    strictMessageTypeSafety: true,
  };
});
