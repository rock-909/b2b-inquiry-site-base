import { getComposedMessages } from "@/lib/i18n/composed-messages";

type StorybookLocale = "en";
type StorybookMessages = Record<string, unknown>;

export function getStorybookLocale(_value: unknown): StorybookLocale {
  return "en";
}

export function getStorybookMessages(
  locale: StorybookLocale,
): StorybookMessages {
  return getComposedMessages(locale);
}
