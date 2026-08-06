import { getTranslations } from "next-intl/server";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import { getCanonicalPath } from "@/config/paths/utils";
import { buildCatalogBreadcrumbJsonLd } from "@/components/products/catalog-breadcrumb-jsonld";
import type { CatalogBreadcrumbProps } from "@/components/products/catalog-breadcrumb-types";
import { CatalogBreadcrumbView } from "@/components/products/catalog-breadcrumb-view";

export async function CatalogBreadcrumb({
  homePrefetch,
  market,
  marketLabel,
  productsPrefetch,
  renderJsonLd = true,
}: CatalogBreadcrumbProps) {
  const tBreadcrumb = await getTranslations("catalog.breadcrumb");
  const tAccessibility = await getTranslations("accessibility");
  const productsPath = getCanonicalPath("products");

  return (
    <>
      <CatalogBreadcrumbView
        ariaLabel={tAccessibility("breadcrumb")}
        homeLabel={tBreadcrumb("home")}
        productsLabel={tBreadcrumb("products")}
        productsHref={productsPath}
        {...(homePrefetch === undefined ? {} : { homePrefetch })}
        {...(productsPrefetch === undefined ? {} : { productsPrefetch })}
        {...(market ? { marketLabel: marketLabel || market.label } : {})}
      />

      {renderJsonLd ? (
        <JsonLdScript
          data={await buildCatalogBreadcrumbJsonLd(
            market ? { market, ...(marketLabel ? { marketLabel } : {}) } : {},
          )}
        />
      ) : null}
    </>
  );
}
