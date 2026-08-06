import type { MarketDefinition } from "@/constants/product-catalog";

export interface CatalogBreadcrumbProps {
  homePrefetch?: boolean;
  market?: MarketDefinition;
  marketLabel?: string;
  productsPrefetch?: boolean;
  renderJsonLd?: boolean;
}
