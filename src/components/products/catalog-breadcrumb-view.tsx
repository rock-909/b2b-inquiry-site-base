import { Link } from "@/i18n/routing";
import type { LinkHref } from "@/lib/i18n/link-href";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export interface CatalogBreadcrumbViewProps {
  ariaLabel: string;
  homeLabel: string;
  homePrefetch?: boolean;
  productsLabel: string;
  productsHref: LinkHref;
  productsPrefetch?: boolean;
  marketLabel?: string;
}

export function CatalogBreadcrumbView({
  ariaLabel,
  homeLabel,
  homePrefetch,
  productsLabel,
  productsHref,
  productsPrefetch,
  marketLabel,
}: CatalogBreadcrumbViewProps) {
  return (
    <Breadcrumb aria-label={ariaLabel}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/" prefetch={homePrefetch}>
              {homeLabel}
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />

        <BreadcrumbItem>
          {marketLabel ? (
            <BreadcrumbLink asChild>
              <Link href={productsHref} prefetch={productsPrefetch}>
                {productsLabel}
              </Link>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{productsLabel}</BreadcrumbPage>
          )}
        </BreadcrumbItem>

        {marketLabel ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{marketLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
