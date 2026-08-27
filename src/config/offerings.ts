export interface Offering {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly description: string;
  readonly applications: readonly string[];
  readonly specifications: readonly {
    readonly label: string;
    readonly value: string;
  }[];
  readonly materials: readonly string[];
  readonly configuration: readonly string[];
  readonly delivery: readonly string[];
  readonly evidence: readonly string[];
  readonly updatedAt: string;
}

export const OFFERINGS = [
  {
    id: "sample-offering",
    name: "Sample Offering",
    summary: "A neutral catalog example for a derived B2B product line.",
    description:
      "Replace this reference entry with verified product facts, applications and buyer guidance before launch.",
    applications: [
      "Name the operating environments and buyer problems this product is designed to address.",
      "State who normally evaluates, specifies, purchases or installs the product.",
      "Explain the conditions where another product or configuration would be more suitable.",
    ],
    specifications: [
      {
        label: "Dimensions or capacity",
        value:
          "Add the verified range, units, tolerances and selection limits.",
      },
      {
        label: "Operating conditions",
        value:
          "State the approved temperature, pressure, load or environment limits.",
      },
      {
        label: "Standards and options",
        value:
          "List only documented standards, grades, sizes and available options.",
      },
    ],
    materials: [
      "Identify the verified material grades, finishes, coatings or construction methods.",
      "Explain how material choices affect service life, maintenance or application fit.",
    ],
    configuration: [
      "Describe the information required to select or configure the product correctly.",
      "Separate standard options from custom engineering or project-specific review.",
    ],
    delivery: [
      "State packaging, order quantity, lead-time and destination constraints only when confirmed.",
      "Clarify which installation, commissioning, documentation or after-sales services are included.",
    ],
    evidence: [
      "Link approved datasheets, drawings, test reports, certificates or project records.",
      "Do not use illustrations, badges or unsupported claims as substitutes for evidence.",
    ],
    // updatedAt 必须反映内容的最后一次显著变更（改 name/summary/description/
    // 产品详情字段时同步 bump）：sitemap 的 lastmod 直接发布此值，过期会向搜索
    // 引擎谎报新鲜度。上次修正：2026-08-25 产品页新增内嵌询盘表单区块。
    updatedAt: "2026-08-26T00:00:00Z",
  },
] as const satisfies readonly Offering[];

export function getOfferingById(id: string | undefined): Offering | undefined {
  return OFFERINGS.find((offering) => offering.id === id);
}

export function getOfferingPath(id: string): string {
  return `/products/${encodeURIComponent(id)}`;
}
