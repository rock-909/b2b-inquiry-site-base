import { buildCatalogBreadcrumbJsonLd } from "@/components/products/catalog-breadcrumb-jsonld";
import { SITE_CONFIG } from "@/config/paths";
import type { MarketDefinition } from "@/constants/product-catalog";
import type { TucsenbergProductPage } from "@/constants/tucsenberg-product-pages";
import { generateProductData } from "@/lib/structured-data-generators";

function getJsonLdProductImage(productPage: TucsenbergProductPage) {
  if (productPage.image.status !== "real") {
    return undefined;
  }

  if (!isSafeRootRelativeImageSrc(productPage.image.src)) {
    return undefined;
  }

  return new URL(productPage.image.src, SITE_CONFIG.baseUrl).toString();
}

function isSafeRootRelativeImageSrc(src: string): boolean {
  const pathname = src.split(/[?#]/u)[0] ?? "";

  return /^\/(?!\/)/u.test(src) && !pathname.split("/").includes("..");
}

export async function buildMarketPageJsonLdData({
  market,
  marketUrl,
  productPage,
}: {
  market: MarketDefinition;
  marketUrl: string;
  productPage: TucsenbergProductPage;
}): Promise<unknown[]> {
  const image = getJsonLdProductImage(productPage);
  const productSchema = generateProductData({
    name: productPage.title,
    description: productPage.lead,
    url: marketUrl,
    brand: SITE_CONFIG.name,
    ...(image ? { image } : {}),
  });
  const breadcrumbSchema = await buildCatalogBreadcrumbJsonLd({
    market,
    marketLabel: productPage.title,
  });

  return [productSchema, breadcrumbSchema];
}
