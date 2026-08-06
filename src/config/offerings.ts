export interface Offering {
  readonly id: string;
  readonly name: string;
}

export const OFFERINGS = [
  {
    id: "custom-fabrication",
    name: "Custom Fabrication",
  },
] as const satisfies readonly Offering[];

export function getOfferingById(id: string | undefined): Offering | undefined {
  return OFFERINGS.find((offering) => offering.id === id);
}
