import { routing } from "@/i18n/routing";

export const generateLocaleStaticParams = () =>
  routing.locales.map((locale) => ({ locale }));

export type LocaleParam = {
  locale: (typeof routing.locales)[number];
};
