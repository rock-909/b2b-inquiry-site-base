import { getTranslations } from "next-intl/server";
import { SINGLE_SITE_CONFIG, SINGLE_SITE_FACTS } from "@/config/single-site";
import {
  getPublicContactPhone,
  getPublicLogoPath,
} from "@/config/public-trust";
import { routing } from "@/i18n/routing";

const FALLBACK_BASE_URL = SINGLE_SITE_CONFIG.baseUrl;
type StructuredDataTranslator = Awaited<
  ReturnType<typeof getTranslations<"structured-data">>
>;

interface ProductInput {
  name: string;
  description: string;
  url: string;
  brand: string;
  image?: string;
}

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

function getSocialProfileUrls(t: StructuredDataTranslator): string[] {
  return [
    t("organization.social.twitter"),
    t("organization.social.linkedin"),
  ].filter((url) => /^https?:\/\//iu.test(url));
}

function buildOrganizationPostalAddress() {
  return {
    "@type": "PostalAddress" as const,
    streetAddress: SINGLE_SITE_FACTS.company.location.address,
    addressLocality: SINGLE_SITE_FACTS.company.location.city,
    addressCountry: SINGLE_SITE_FACTS.company.location.country,
  };
}

/**
 * 生成组织结构化数据
 */
export function generateOrganizationData(t: StructuredDataTranslator) {
  const logoPath = getPublicLogoPath();
  const telephone = getPublicContactPhone(SINGLE_SITE_CONFIG.contact.phone);
  const sameAs = getSocialProfileUrls(t);
  const { email } = SINGLE_SITE_CONFIG.contact;

  return {
    "@type": "Organization",
    "@id": organizationStructuredDataId(),
    name: t("organization.name"),
    description: t("organization.description"),
    url: FALLBACK_BASE_URL,
    ...(email ? { email } : {}),
    foundingDate: String(SINGLE_SITE_FACTS.company.established),
    address: buildOrganizationPostalAddress(),
    ...(logoPath
      ? { logo: new URL(logoPath, FALLBACK_BASE_URL).toString() }
      : {}),
    contactPoint: {
      "@type": "ContactPoint",
      ...(telephone ? { telephone } : {}),
      contactType: "customer service",
      availableLanguage: routing.locales,
    },
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

/**
 * 生成网站结构化数据
 */
export function generateWebSiteData(t: StructuredDataTranslator) {
  return {
    "@type": "WebSite",
    "@id": websiteStructuredDataId(),
    name: t("website.name"),
    description: t("website.description"),
    url: FALLBACK_BASE_URL,
    publisher: {
      "@id": organizationStructuredDataId(),
    },
    inLanguage: routing.locales,
  };
}

export function generateProductData(
  data: ProductInput,
): Record<string, unknown> {
  return {
    "@type": "Product",
    name: data.name,
    description: data.description,
    url: data.url,
    brand: {
      "@type": "Brand",
      name: data.brand,
    },
    ...(data.image ? { image: data.image } : {}),
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
    about: {
      "@id": organizationStructuredDataId(FALLBACK_BASE_URL),
    },
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
