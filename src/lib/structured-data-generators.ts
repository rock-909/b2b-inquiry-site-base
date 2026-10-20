import { getTranslations } from "next-intl/server";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";
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
  // 只读显式字段：留空即省略；占位值由上线门禁拦截，这里不猜。
  const { company, contact, social, brandAssets } = SINGLE_SITE_CONFIG;
  // 纯空白等同留空：不输出。
  const name = company?.name?.trim();
  if (!company || !name) return undefined;
  const { email, phone: telephone } = contact;
  const logoPath =
    brandAssets.logo?.status === "ready"
      ? brandAssets.logo.horizontal
      : undefined;
  const { address: streetAddress, city, country } = company.location ?? {};
  const address = Object.fromEntries(
    Object.entries({
      streetAddress,
      addressLocality: city,
      addressCountry: country,
    }).filter(([, value]) => value?.trim()),
  );
  const sameAs = Object.values(social).filter(Boolean);
  return {
    "@type": "Organization",
    "@id": organizationStructuredDataId(),
    name,
    url: FALLBACK_BASE_URL,
    ...(email ? { email } : {}),
    ...(company.established
      ? { foundingDate: String(company.established) }
      : {}),
    ...(Object.keys(address).length
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
