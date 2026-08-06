import type { TucsenbergProductPage } from "@/constants/tucsenberg-product-page-types";
import { ABS_FLOOD_BARRIERS_PRODUCT_PAGE } from "@/constants/tucsenberg-product-page-abs-flood-barriers";
import { ABSORBENT_FLOOD_BAGS_PRODUCT_PAGE } from "@/constants/tucsenberg-product-page-absorbent-flood-bags";
import { ALUMINUM_FLOOD_GATES_PRODUCT_PAGE } from "@/constants/tucsenberg-product-page-aluminum-flood-gates";
import { FLOOD_TUBE_DAMS_PRODUCT_PAGE } from "@/constants/tucsenberg-product-page-flood-tube-dams";
import { FRP_FLOOD_BARRIERS_PRODUCT_PAGE } from "@/constants/tucsenberg-product-page-frp-flood-barriers";

export type {
  TucsenbergProductCta,
  TucsenbergProductDiagram,
  TucsenbergProductDiagramKind,
  TucsenbergProductFaq,
  TucsenbergProductImage,
  TucsenbergProductPage,
  TucsenbergProductProseSection,
  TucsenbergProductSection,
  TucsenbergProductTable,
  TucsenbergProductTableSection,
} from "@/constants/tucsenberg-product-page-types";

export const TUCSENBERG_PRODUCT_PAGES = {
  "abs-flood-barriers": ABS_FLOOD_BARRIERS_PRODUCT_PAGE,
  "aluminum-flood-gates": ALUMINUM_FLOOD_GATES_PRODUCT_PAGE,
  "absorbent-flood-bags": ABSORBENT_FLOOD_BAGS_PRODUCT_PAGE,
  "flood-tube-dams": FLOOD_TUBE_DAMS_PRODUCT_PAGE,
  "frp-flood-barriers": FRP_FLOOD_BARRIERS_PRODUCT_PAGE,
} as const satisfies Record<string, TucsenbergProductPage>;

export type TucsenbergProductPageSlug = keyof typeof TUCSENBERG_PRODUCT_PAGES;

export function getTucsenbergProductPage(
  slug: string,
): TucsenbergProductPage | undefined {
  return Object.hasOwn(TUCSENBERG_PRODUCT_PAGES, slug)
    ? TUCSENBERG_PRODUCT_PAGES[slug as TucsenbergProductPageSlug]
    : undefined;
}
