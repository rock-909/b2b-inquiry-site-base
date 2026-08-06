import { screen } from "@testing-library/react";
import { expect } from "vitest";

export const mockCatalogTranslationsEn = {
  "overview.title": "Flood Barrier Product Lines",
  "overview.description":
    "Five flood barrier lines for dealers, importers, brands, contractors and small business buyers: ABS boxwall, aluminum flood gates, absorbent flood bags, tube dams and FRP composite planks.",
  "overview.cardsTitle": "Start with the product line",
  "overview.cardsDescription":
    "Match the opening, ground type and order size before asking for exact quotation details.",
  "overview.boundaryTitle": "No published-price games",
  "overview.boundaryDescription":
    "The quote is the price conversation. Send dimensions, quantity, market and delivery port so the line can be checked properly.",
  "overview.pathTitle": "How this overview should work",
  "overview.pathDescription":
    "Scan the five lines, compare where each one fits, then send an RFQ with dimensions, quantity and market.",
  "overview.detailTitle": "When to open a product page",
  "overview.detailDescription":
    "Use the detail pages when the buying question depends on material, opening type, deployment method or OEM/private label options.",
  "boundary.items.content": "Prices stay in the quotation, not on public pages",
  "boundary.items.assets": "Photos and drawings are welcome with the RFQ",
  "boundary.items.details":
    "Custom-cut and private label details are confirmed per order",
  "path.items.scan.title": "Scan the five lines",
  "path.items.scan.description":
    "ABS boxwall, aluminum gates, flood bags, tube dams and FRP planks cover different site conditions.",
  "path.items.compare.title": "Check the fit",
  "path.items.compare.description":
    "Defined openings, perimeters, emergency stock, rough ground and corrosive sites need different materials.",
  "path.items.ask.title": "Send the RFQ",
  "path.items.ask.description":
    "Standard items are quoted in 12 hours; custom configurations within 48.",
  "detail.items.families":
    "Product family, material and deployment method affect the recommendation",
  "detail.items.comparison":
    "Specification tables and drawings decide custom-cut configurations",
  "detail.items.markets":
    "OEM/private label, cartons, pallets, LCL, container and project schedules are quoted differently",
  "cta.title": "Need more detail before contacting?",
  "cta.description":
    "Send an RFQ with openings, quantity, market and delivery port.",
  "cta.resources": "View guides",
  "cta.specificationsGuide": "View specifications guide",
  "cta.contact": "Request a Quote",
  "markets.abs-flood-barriers.label": "ABS Interlocking Boxwall Flood Barriers",
  "markets.abs-flood-barriers.description":
    "Freestanding ABS interlocking flood barriers for driveways, doorways and paved perimeters.",
  "markets.aluminum-flood-gates.label":
    "Aluminum Flood Gates & Demountable Barrier Systems",
  "markets.aluminum-flood-gates.description":
    "Demountable plank systems for doors, garages, loading docks and shopfronts.",
  "markets.absorbent-flood-bags.label":
    "Absorbent Flood Bags (Sandless Sandbags)",
  "markets.absorbent-flood-bags.description":
    "Water-activated sandless flood bags for low-level freshwater leaks, thresholds and reseller stock.",
  "markets.flood-tube-dams.label": "Water & Air-Filled Tube Dams",
  "markets.flood-tube-dams.description":
    "Inflatable PVC tube dams for long runs, rough ground and planned emergency stock.",
  "markets.frp-flood-barriers.label": "FRP Composite Planks",
  "markets.frp-flood-barriers.description":
    "Order-driven pultruded FRP flood planks for coastal, industrial and electrical sites.",
} as const;

export const mockCatalogTranslationsZh = {
  "overview.title": "防洪产品线",
  "overview.description":
    "用这个页面介绍访客在联系前需要了解的主要产品线或业务组合。",
  "overview.cardsTitle": "访客应该在这里了解什么",
  "overview.cardsDescription":
    "默认概览要短。把这些卡片替换成真实产品组、证明材料和购买下一步。",
  "overview.boundaryTitle": "上线前需要替换",
  "overview.boundaryDescription":
    "结构已经准备好，但真实业务事实必须来自真实公司。",
  "overview.pathTitle": "这个概览页应该怎么发挥作用",
  "overview.pathDescription":
    "把页面保持成简单地图：展示业务组合、指向证明材料，再把访客引导到资料或联系入口。",
  "overview.detailTitle": "只有真正需要时才使用详情页",
  "overview.detailDescription":
    "在真实业务的产品系列、比较规则和报价逻辑准备好前，先保持轻量概览。",
  "boundary.items.content": "替换产品名称和介绍",
  "boundary.items.assets": "替换图片、手册和证明材料",
  "boundary.items.details": "补充真实供货、价格或报价规则",
  "path.items.scan.title": "浏览产品组合",
  "path.items.scan.description": "让访客先理解业务系列，再询问具体细节。",
  "path.items.compare.title": "查看证明材料",
  "path.items.compare.description":
    "当访客需要手册、图片或买家指南时，引导到资料页。",
  "path.items.ask.title": "询问适配性",
  "path.items.ask.description":
    "当访客需要价格、供货或项目适配判断时，引导到联系页。",
  "detail.items.families": "真实产品系列和优先级已经确认",
  "detail.items.comparison": "规格或比较规则会影响采购判断",
  "detail.items.markets": "市场、标准或供货情况需要独立页面",
  "cta.title": "联系前需要更多资料？",
  "cta.description": "可以先查看资料页，也可以在访客准备好时直接联系。",
  "cta.resources": "查看指南",
  "cta.specificationsGuide": "查看规格指南",
  "cta.contact": "提交询价",
  "markets.abs-flood-barriers.label": "ABS 拼接式挡水板",
  "markets.abs-flood-barriers.description":
    "用于车道、门口和硬质地面周界的免固定 ABS 拼接式挡水板。",
  "markets.aluminum-flood-gates.label": "铝合金挡水闸与可拆卸挡水系统",
  "markets.aluminum-flood-gates.description":
    "用于门口、车库、装卸口和店面的可拆卸铝合金挡水板系统。",
  "markets.absorbent-flood-bags.label": "吸水膨胀防洪袋",
  "markets.absorbent-flood-bags.description":
    "用于低水位淡水渗漏、门槛和经销备货的遇水膨胀防洪袋。",
  "markets.flood-tube-dams.label": "水/气填充管式防洪坝",
  "markets.flood-tube-dams.description":
    "用于长距离、粗糙地面和应急备货的 PVC 充气/充水管坝。",
  "markets.frp-flood-barriers.label": "FRP 复合挡水板",
  "markets.frp-flood-barriers.description":
    "面向沿海、工业和电气场景的订单制拉挤 FRP 挡水板。",
} as const;

export function createCatalogTranslator(
  locale: string,
): (key: string) => string {
  const translations =
    locale === "zh" ? mockCatalogTranslationsZh : mockCatalogTranslationsEn;

  return (key: string) => translations[key as keyof typeof translations] || key;
}

export function assertNoHeavyCatalogOrDeveloperDemoCopy() {
  expect(screen.queryByText(/Technical proof/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Cloudflare\/OpenNext/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Example Standard/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/certification/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/spec matrix/i)).not.toBeInTheDocument();
}
