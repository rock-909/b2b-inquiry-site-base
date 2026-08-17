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
    updatedAt: "2026-08-12T00:00:00Z",
  },
] as const satisfies readonly Offering[];

export function getOfferingById(id: string | undefined): Offering | undefined {
  return OFFERINGS.find((offering) => offering.id === id);
}

export function getOfferingPath(id: string): string {
  return `/products/${encodeURIComponent(id)}`;
}
