import { getTranslations } from "next-intl/server";
import { SINGLE_SITE_CONFIG, SINGLE_SITE_FACTS } from "@/config/single-site";
import {
  getPublicContactEmail,
  getPublicFact,
  getPublicFoundingYear,
  getPublicSocialUrl,
  getPublicContactPhone,
  getPublicLogoPath,
} from "@/config/public-trust";
import { routing } from "@/i18n/routing";

const FALLBACK_BASE_URL = SINGLE_SITE_CONFIG.baseUrl;
type StructuredDataTranslator = Awaited<
  ReturnType<typeof getTranslations<"structured-data">>
>;

interface WebPageSchemaInput {
  locale: string;
  name: string;
  description?: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
}

export function organizationStructuredDataId(
  baseUrl: string = FALLBACK_BASE_URL,
) {
  return `${baseUrl}#organization`;
}

export function websiteStructuredDataId(baseUrl: string = FALLBACK_BASE_URL) {
  return `${baseUrl}#website`;
}

export function generateOrganizationData() {
  const { company } = SINGLE_SITE_FACTS;
  if (!company) return undefined;
  const name = getPublicFact(company.name);
  if (!name) return undefined;
  const logoPath = getPublicLogoPath();
  const telephone = getPublicContactPhone();
  const email = getPublicContactEmail();
  const foundingYear = getPublicFoundingYear(company.established);
  const address = {
    streetAddress: getPublicFact(company.location?.address),
    addressLocality: getPublicFact(company.location?.city),
    addressCountry: getPublicFact(company.location?.country),
  };
  const sameAs = Object.values(SINGLE_SITE_FACTS.social)
    .map(getPublicSocialUrl)
    .filter(Boolean);
  return {
    "@type": "Organization",
    "@id": organizationStructuredDataId(),
    name,
    url: FALLBACK_BASE_URL,
    ...(email ? { email } : {}),
    ...(foundingYear ? { foundingDate: String(foundingYear) } : {}),
    ...(Object.values(address).some(Boolean)
      ? { address: { "@type": "PostalAddress", ...address } }
      : {}),
    ...(logoPath
      ? { logo: new URL(logoPath, FALLBACK_BASE_URL).toString() }
      : {}),
    ...(telephone ? { telephone } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/**
 * 生成网站结构化数据
 */
export function generateWebSiteData(t: StructuredDataTranslator) {
  return {
    "@type": "WebSite",
    "@id": websiteStructuredDataId(),
    name: SINGLE_SITE_CONFIG.name,
    description: t("website.description"),
    url: FALLBACK_BASE_URL,
    ...(generateOrganizationData()
      ? { publisher: { "@id": organizationStructuredDataId() } }
      : {}),
    inLanguage: routing.locales,
  };
}

export function buildWebPageSchema(
  data: WebPageSchemaInput,
): Record<string, unknown> {
  return {
    "@type": "WebPage",
    "@id": data.url,
    url: data.url,
    inLanguage: data.locale,
    name: data.name,
    ...(data.description ? { description: data.description } : {}),
    ...(data.datePublished ? { datePublished: data.datePublished } : {}),
    ...(data.dateModified ? { dateModified: data.dateModified } : {}),
    isPartOf: {
      "@id": websiteStructuredDataId(FALLBACK_BASE_URL),
    },
    ...(generateOrganizationData()
      ? { about: { "@id": organizationStructuredDataId(FALLBACK_BASE_URL) } }
      : {}),
  };
}

export function buildBreadcrumbListSchema(
  items: Array<{ name: string; url: string }>,
): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
