import en from "../../messages/base/en/messages.json";
import es from "../../messages/base/es/messages.json";
import { getStaticPage } from "../../src/lib/content/static-pages";

export function getSitePageCases(locale: "en" | "es") {
  const messages = locale === "es" ? es : en;
  const prefix = locale === "es" ? "/es" : "";
  return [
    [prefix || "/", messages.home.hero.title],
    [`${prefix}/products`, messages.products.page.heading],
    ...(["about", "contact", "privacy", "terms"] as const).map(
      (slug) =>
        [
          `${prefix}/${slug}`,
          getStaticPage(slug, locale).metadata.title,
        ] as const,
    ),
  ] as const;
}

export const SITE_PAGE_CASES = getSitePageCases("en");
