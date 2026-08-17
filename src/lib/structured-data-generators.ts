import { getTranslations } from "next-intl/server";
import { SINGLE_SITE_CONFIG, SINGLE_SITE_FACTS } from "@/config/single-site";
import type {
  ArticleData,
  BreadcrumbData,
  OrganizationData,
  WebSiteData,
} from "@/lib/structured-data-types";
import {
  getPublicContactPhone,
  getPublicLogoPath,
} from "@/config/public-trust";
import { routing, type Locale } from "@/i18n/routing";

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
  const twitter =
    t("organization.social.twitter") ?? SINGLE_SITE_CONFIG.social.twitter;
  const linkedin =
    t("organization.social.linkedin") ?? SINGLE_SITE_CONFIG.social.linkedin;

  return [twitter, linkedin].filter((url) => /^https?:\/\//iu.test(url));
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
export function generateOrganizationData(
  t: StructuredDataTranslator,
  data: OrganizationData = {},
) {
  const baseUrl = data.url ?? FALLBACK_BASE_URL;
  const logoPath = data.logo ?? getPublicLogoPath();
  const telephone = getPublicContactPhone(
    data.phone ?? SINGLE_SITE_CONFIG.contact.phone,
  );
  const sameAs = getSocialProfileUrls(t);
  const email = data.email ?? SINGLE_SITE_CONFIG.contact.email;

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": organizationStructuredDataId(baseUrl),
    name: data.name ?? t("organization.name") ?? SINGLE_SITE_CONFIG.name,
    description:
      data.description ??
      t("organization.description") ??
      SINGLE_SITE_CONFIG.description,
    url: baseUrl,
    ...(email ? { email } : {}),
    foundingDate: String(SINGLE_SITE_FACTS.company.established),
    address: buildOrganizationPostalAddress(),
    ...(logoPath ? { logo: new URL(logoPath, baseUrl).toString() } : {}),
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
export function generateWebSiteData(
  t: StructuredDataTranslator,
  data: WebSiteData = {},
) {
  const baseUrl = data.url ?? FALLBACK_BASE_URL;

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteStructuredDataId(baseUrl),
    name: data.name ?? t("website.name") ?? SINGLE_SITE_CONFIG.name,
    description:
      data.description ??
      t("website.description") ??
      SINGLE_SITE_CONFIG.seo.defaultDescription,
    url: baseUrl,
    publisher: {
      "@id": organizationStructuredDataId(baseUrl),
    },
    inLanguage: routing.locales,
  };
}

/**
 * 生成文章结构化数据
 */
export function generateArticleData(
  t: StructuredDataTranslator,
  locale: Locale,
  data: ArticleData,
) {
  const logoPath = getPublicLogoPath();
  const organizationId = organizationStructuredDataId(FALLBACK_BASE_URL);

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: data.title,
    description: data.description,
    author: {
      "@type": "Organization",
      "@id": organizationId,
      name:
        data.author ?? t("article.defaultAuthor") ?? SINGLE_SITE_CONFIG.name,
    },
    publisher: {
      "@type": "Organization",
      "@id": organizationId,
      name: t("organization.name") ?? SINGLE_SITE_CONFIG.name,
      ...(logoPath
        ? {
            logo: {
              "@type": "ImageObject",
              url: new URL(logoPath, FALLBACK_BASE_URL).toString(),
            },
          }
        : {}),
    },
    datePublished: data.publishedTime,
    dateModified: data.modifiedTime || data.publishedTime,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": data.url,
    },
    image: data.image
      ? {
          "@type": "ImageObject",
          url: data.image,
        }
      : undefined,
    inLanguage: locale,
    section: data.section,
  };
}

export function generateProductData(
  data: ProductInput,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
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
    "@context": "https://schema.org",
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
  return generateBreadcrumbData({
    items: items.map((item, index) => ({
      ...item,
      position: index + 1,
    })),
  });
}

/**
 * 生成面包屑结构化数据
 */
export function generateBreadcrumbData(data: BreadcrumbData) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement:
      data.items?.map((item, index) => ({
        "@type": "ListItem",
        position: item.position || index + 1,
        name: item.name,
        item: item.url,
      })) || [],
  };
}
