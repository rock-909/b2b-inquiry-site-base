/**
 * Canonical locale configuration.
 */

export const LOCALES_CONFIG = Object.freeze({
  locales: Object.freeze(["en", "es"] as const),
  defaultLocale: "en" as const,
  localePrefix: "as-needed" as const,
  displayNames: Object.freeze({
    en: "English",
    es: "Español",
  }),
  triggerLabels: Object.freeze({
    en: "English",
    es: "Español",
  }),
  timeZones: Object.freeze({
    en: "UTC",
    es: "Europe/Madrid",
  }),
} as const);

/**
 * @public Locale configuration contract for downstream routing customization.
 */
export type LocalesConfig = typeof LOCALES_CONFIG;
export type ConfiguredLocale = (typeof LOCALES_CONFIG.locales)[number];

export function getLocaleTimeZone(locale: ConfiguredLocale): string {
  return LOCALES_CONFIG.timeZones[locale];
}
