import type { MarketDefinition, ProductCatalog } from "@/config/site-types";

const productLines = [
  {
    slug: "abs-flood-barriers",
    label: "ABS Interlocking Boxwall",
    standardLabel: "TB-BW series",
    sizeSystem: "mm",
    standardIds: ["tb_bw"],
  },
  {
    slug: "aluminum-flood-gates",
    label: "Aluminum Flood Gates",
    standardLabel: "TB-AG series",
    sizeSystem: "mm",
    standardIds: ["tb_ag"],
  },
  {
    slug: "absorbent-flood-bags",
    label: "Absorbent Flood Bags",
    standardLabel: "TB-FB series",
    sizeSystem: "mm",
    standardIds: ["tb_fb"],
  },
  {
    slug: "flood-tube-dams",
    label: "Water & Air-Filled Tube Dams",
    standardLabel: "TB-TD series",
    sizeSystem: "mm",
    standardIds: ["tb_td"],
  },
  {
    slug: "frp-flood-barriers",
    label: "FRP Composite Planks",
    standardLabel: "TB-CP series",
    sizeSystem: "mm",
    standardIds: ["tb_cp"],
  },
] as const satisfies readonly MarketDefinition[];

export type ProductMarketSlug = (typeof productLines)[number]["slug"];

export const singleSiteProductCatalog = {
  markets: productLines,
} as const satisfies ProductCatalog;
