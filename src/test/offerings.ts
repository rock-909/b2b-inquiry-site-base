export const TEST_OFFERING = {
  id: "test-offering",
  name: "Test Offering",
} as const;

export const OFFERINGS = [TEST_OFFERING] as const;

export function getOfferingById(id: string | undefined) {
  return OFFERINGS.find((offering) => offering.id === id);
}
