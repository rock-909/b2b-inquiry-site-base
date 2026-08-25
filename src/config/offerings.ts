export interface Offering {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly description: string;
  readonly highlights: readonly string[];
  readonly updatedAt: string;
}

export const OFFERINGS = [
  {
    id: "sample-offering",
    name: "Sample Offering",
    summary: "A neutral catalog example for a derived B2B product line.",
    description:
      "Replace this reference entry with verified product facts, applications and buyer guidance before launch.",
    highlights: [
      "Describe the buyer problem this product addresses.",
      "Add only specifications and proof the owner can verify.",
      "Use the shared inquiry path for project-specific questions.",
    ],
    // updatedAt 必须反映内容的最后一次显著变更（改 name/summary/description/
    // highlights 时同步 bump）：sitemap 的 lastmod 直接发布此值，过期会向搜索
    // 引擎谎报新鲜度。上次修正：2026-08-25 产品页新增内嵌询盘表单区块。
    updatedAt: "2026-08-25T00:00:00Z",
  },
] as const satisfies readonly Offering[];

export function getOfferingById(id: string | undefined): Offering | undefined {
  return OFFERINGS.find((offering) => offering.id === id);
}

export function getOfferingPath(id: string): string {
  return `/products/${encodeURIComponent(id)}`;
}
