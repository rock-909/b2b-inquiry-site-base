import { getTranslations } from "next-intl/server";
import { getCanonicalPath, getProductMarketPath } from "@/config/paths/utils";
import type { CatalogBreadcrumbProps } from "@/components/products/catalog-breadcrumb-types";
import { buildCanonicalForPath } from "@/lib/seo-metadata";
import { buildBreadcrumbListSchema } from "@/lib/structured-data-generators";

export async function buildCatalogBreadcrumbJsonLd({
  market,
  marketLabel,
}: CatalogBreadcrumbProps) {
  const tBreadcrumb = await getTranslations("catalog.breadcrumb");
  const productsPath = getCanonicalPath("products");

  const entries: Array<{ name: string; url: string }> = [
    {
      name: tBreadcrumb("home"),
      url: buildCanonicalForPath("/"),
    },
    {
      name: tBreadcrumb("products"),
      url: buildCanonicalForPath(productsPath),
    },
  ];

  if (market) {
    entries.push({
      name: marketLabel || market.label,
      url: buildCanonicalForPath(getProductMarketPath(market.slug)),
    });
  }

  return buildBreadcrumbListSchema(entries);
}
