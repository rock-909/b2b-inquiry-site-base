import aboutPage from "@/content/pages/en/about";
import contactPage from "@/content/pages/en/contact";
import privacyPage from "@/content/pages/en/privacy";
import termsPage from "@/content/pages/en/terms";
import type { Locale, Page } from "@/types/content.types";

const STATIC_PAGES: Record<Locale, Record<string, Page>> = {
  en: {
    about: aboutPage,
    contact: contactPage,
    privacy: privacyPage,
    terms: termsPage,
  },
};

export function getStaticPage(slug: string, locale: Locale): Page {
  const page = STATIC_PAGES[locale]?.[slug];
  if (page === undefined) {
    throw new Error(`Content not found: ${slug}`);
  }
  return page;
}

export function getOptionalStaticPage(
  slug: string,
  locale: Locale,
): Page | undefined {
  return STATIC_PAGES[locale]?.[slug];
}

export { STATIC_PAGES };
